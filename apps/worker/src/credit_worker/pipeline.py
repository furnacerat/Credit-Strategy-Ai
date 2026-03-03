# pyright: reportMissingImports=false, reportMissingTypeStubs=false

from __future__ import annotations

from pathlib import Path
import tempfile
from typing import Any
import json
import re

import psycopg

from credit_worker.pdf.real_extract import extract_text_pages, page_count
from credit_worker.parse.items import iter_report_items
from credit_worker.ai.openai_http import OpenAIHttp
from credit_worker.ai.recommend import recommend_items_for_report
from credit_worker.ai.extract_full_report import extract_ui_report
from credit_worker.ai.report_schema import empty_report


def set_report_status(
  conn: psycopg.Connection,
  *,
  report_id: str,
  status: str,
  progress: int | None = None,
  error: str | None = None
) -> None:
  with conn.cursor() as cur:
    cur.execute(
      """
      update public.reports
      set
        status = %s::report_status,
        progress = coalesce(%s, progress),
        error = %s,
        updated_at = now()
      where id = %s;
      """,
      (status, progress, error, report_id)
    )


def upsert_page(
  conn: psycopg.Connection, *, report_id: str, page_number: int, text: str, ocr_used: bool
) -> None:
  with conn.cursor() as cur:
    cur.execute(
      """
      insert into public.report_pages (report_id, page_number, text, ocr_used)
      values (%s, %s, %s, %s)
      on conflict (report_id, page_number)
      do update set text = excluded.text, ocr_used = excluded.ocr_used;
      """,
      (report_id, page_number, text, ocr_used)
    )


def insert_item(
  conn: psycopg.Connection,
  *,
  report_id: str,
  bureau: str | None,
  category: str,
  creditor: str | None,
  account_ref: str | None,
  occurred_on,
  amount,
  confidence: float,
  page_number: int,
  raw_text: str
) -> None:
  with conn.cursor() as cur:
    cur.execute(
      """
      insert into public.report_items
        (report_id, bureau, category, creditor, account_ref, occurred_on, amount, confidence, page_number, raw_text)
      values
        (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
      """,
      (report_id, bureau, category, creditor, account_ref, occurred_on, amount, confidence, page_number, raw_text)
    )


def upsert_analysis(conn: psycopg.Connection, *, report_id: str, result: dict[str, Any]) -> None:
  # Persist analysis on the report row (UI contract) and in report_analysis (history/trace).
  with conn.cursor() as cur:
    cur.execute(
      """
      update public.reports
      set analysis_json = %s::jsonb, updated_at = now()
      where id = %s;
      """,
      (json.dumps(result), report_id)
    )

  with conn.cursor() as cur:
    cur.execute(
      """
      insert into public.report_analysis (report_id, result)
      values (%s, %s::jsonb)
      on conflict (report_id)
      do update set result = excluded.result, updated_at = now();
      """,
      (report_id, json.dumps(result))
    )


def insert_letter(
  conn: psycopg.Connection,
  *,
  report_id: str,
  bureau: str,
  storage_bucket: str,
  storage_path: str,
  letter_text: str
) -> None:
  with conn.cursor() as cur:
    cur.execute(
      """
      insert into public.dispute_letters (report_id, bureau, storage_bucket, storage_path, letter_text)
      values (%s, %s, %s, %s, %s);
      """,
      (report_id, bureau, storage_bucket, storage_path, letter_text)
    )


def parse_pdf_to_pages(
  *,
  pdf_file: Path,
  conn: psycopg.Connection,
  report_id: str,
  ocr_enabled: bool,
  tesseract_lang: str
) -> None:
  # For now we store per-page text and update progress.
  total = max(1, page_count(str(pdf_file)))
  for idx, p in enumerate(
    extract_text_pages(
      str(pdf_file),
      ocr_enabled=ocr_enabled,
      tesseract_lang=tesseract_lang
    ),
    start=1
  ):
    upsert_page(conn, report_id=report_id, page_number=p.page_number, text=p.text, ocr_used=p.ocr_used)

    # Extract items for dashboard + letters.
    for item in iter_report_items(page_number=p.page_number, page_text=p.text):
      insert_item(
        conn,
        report_id=report_id,
        bureau=item.bureau,
        category=item.category,
        creditor=item.creditor,
        account_ref=item.account_ref,
        occurred_on=item.occurred_on,
        amount=item.amount,
        confidence=item.confidence,
        page_number=item.page_number,
        raw_text=item.raw_text
      )

    progress = int((idx / total) * 90)
    set_report_status(conn, report_id=report_id, status='processing', progress=progress)


def _full_text(conn: psycopg.Connection, *, report_id: str) -> str:
  with conn.cursor() as cur:
    cur.execute(
      """
      select page_number, text
      from public.report_pages
      where report_id = %s
      order by page_number asc;
      """,
      (report_id,)
    )
    rows = cur.fetchall() or []
  parts: list[str] = []
  for page_number, text in rows:
    parts.append(f"\n\n--- PAGE {page_number} ---\n")
    parts.append(text or '')
  return ''.join(parts)


def _has_analysis_json(conn: psycopg.Connection, *, report_id: str) -> bool:
  with conn.cursor() as cur:
    cur.execute(
      "select analysis_json is not null from public.reports where id = %s;",
      (report_id,)
    )
    row = cur.fetchone()
  return bool(row and row[0])


def _extract_score_from_text(text: str) -> int | None:
  patterns = [
    r"\bFICO\b[^\d]{0,40}(\d{3})\b",
    r"\bVantage\s*Score\b[^\d]{0,40}(\d{3})\b",
    r"\bCredit\s*Score\b[^\d]{0,40}(\d{3})\b",
    r"\bScore\b[^\d]{0,20}(\d{3})\b"
  ]
  for pat in patterns:
    m = re.search(pat, text, flags=re.IGNORECASE)
    if not m:
      continue
    v = int(m.group(1))
    if 300 <= v <= 850:
      return v
  return None


def _extraction_metrics(conn: psycopg.Connection, *, report_id: str, pdf_file: Path) -> dict[str, Any]:
  total_pages = page_count(str(pdf_file))

  with conn.cursor() as cur:
    cur.execute(
      """
      select
        count(*) filter (where ocr_used) as ocr_pages,
        sum(length(text)) as total_chars
      from public.report_pages
      where report_id = %s;
      """,
      (report_id,)
    )
    row = cur.fetchone() or (0, 0)
    ocr_pages = int(row[0] or 0)
    total_chars = int(row[1] or 0)

  with conn.cursor() as cur:
    cur.execute(
      """
      select category, count(*)
      from public.report_items
      where report_id = %s
      group by category
      order by category;
      """,
      (report_id,)
    )
    counts = {str(cat): int(cnt) for (cat, cnt) in (cur.fetchall() or [])}

  negatives = 0
  for k in ['late_payment', 'charge_off', 'collection', 'repossession', 'bankruptcy', 'public_record']:
    negatives += int(counts.get(k, 0))

  score = None
  try:
    score = _extract_score_from_text(_full_text(conn, report_id=report_id))
  except Exception:
    score = None

  return {
    'pages': total_pages,
    'ocr_pages': ocr_pages,
    'total_chars': total_chars,
    'counts': counts,
    'negative_accounts_count': negatives,
    'score': score
  }


def _basic_ui_payload(conn: psycopg.Connection, *, report_id: str, pdf_file: Path) -> dict[str, Any]:
  base = empty_report()
  metrics = _extraction_metrics(conn, report_id=report_id, pdf_file=pdf_file)

  base['credit_summary'] = {
    'score': metrics.get('score'),
    'total_accounts': None,
    'negative_accounts_count': metrics.get('negative_accounts_count'),
    'estimated_score_range': None,
    'on_time_payment_ratio': None,
    'oldest_account_age': None,
    'pages': metrics.get('pages'),
    'ocr_pages': metrics.get('ocr_pages'),
    'total_chars': metrics.get('total_chars'),
    'counts': metrics.get('counts')
  }

  # Basic priority issues from counts when AI is unavailable.
  priority = []
  counts = metrics.get('counts') or {}
  if int(counts.get('collection', 0)) > 0:
    priority.append(
      {
        'reason': 'Collections detected on your report.',
        'impact_level': 'HIGH',
        'recommended_action': 'Review each collection for accuracy and consider validation/dispute if unverifiable.'
      }
    )
  if int(counts.get('charge_off', 0)) > 0:
    priority.append(
      {
        'reason': 'Charge-off(s) detected.',
        'impact_level': 'HIGH',
        'recommended_action': 'Verify dates/balances/ownership; dispute inaccurate items; consider settlement strategy if valid.'
      }
    )
  if int(counts.get('late_payment', 0)) > 0:
    priority.append(
      {
        'reason': 'Late payments detected.',
        'impact_level': 'MEDIUM',
        'recommended_action': 'Check for incorrect dates/status; pursue goodwill removals for isolated lates; dispute inaccuracies.'
      }
    )
  if int(counts.get('bankruptcy', 0)) > 0 or int(counts.get('public_record', 0)) > 0:
    priority.append(
      {
        'reason': 'Public record items detected.',
        'impact_level': 'HIGH',
        'recommended_action': 'Verify court details and reporting period; dispute any mismatches or unverifiable entries.'
      }
    )
  base['priority_issues'] = priority[:3]

  # Minimal negative_items derived from extracted items.
  with conn.cursor() as cur:
    cur.execute(
      """
      select category, bureau, creditor, account_ref, occurred_on, amount, page_number
      from public.report_items
      where report_id = %s
        and category in ('late_payment','charge_off','collection','repossession','bankruptcy','public_record')
      order by created_at asc
      limit 200;
      """,
      (report_id,)
    )
    rows = cur.fetchall() or []

  base['negative_items'] = [
    {
      'category': r[0],
      'bureau': r[1],
      'creditor_name': r[2],
      'account_number': r[3],
      'occurred_on': str(r[4]) if r[4] else None,
      'amount': float(r[5]) if r[5] is not None else None,
      'page_number': r[6],
      'severity_score': None,
      'estimated_score_impact': None,
      'dispute_recommendation': None
    }
    for r in rows
  ]

  return base


def _overlay_extraction_metrics(conn: psycopg.Connection, *, report_id: str, pdf_file: Path) -> None:
  """Overlay computed extraction metrics onto analysis_json.

  This ensures the UI always has: pages/ocr_pages/total_chars/counts/score when available.
  """

  metrics = _extraction_metrics(conn, report_id=report_id, pdf_file=pdf_file)

  with conn.cursor() as cur:
    cur.execute(
      "select analysis_json from public.reports where id = %s;",
      (report_id,)
    )
    row = cur.fetchone()
  if not row or not row[0] or not isinstance(row[0], dict):
    return

  analysis = row[0]
  cs = analysis.get('credit_summary') or {}
  if not isinstance(cs, dict):
    cs = {}

  # Non-destructive fill for these keys.
  for k in ['pages', 'ocr_pages', 'total_chars', 'counts']:
    if cs.get(k) in (None, '', [], {}):
      cs[k] = metrics.get(k)

  # Fill score only if missing.
  if cs.get('score') in (None, '') and metrics.get('score') is not None:
    cs['score'] = metrics.get('score')

  # Negative count: use the max of existing and extracted.
  try:
    cur_neg = cs.get('negative_accounts_count')
    extracted_neg = metrics.get('negative_accounts_count')
    if isinstance(extracted_neg, int):
      if not isinstance(cur_neg, int) or extracted_neg > cur_neg:
        cs['negative_accounts_count'] = extracted_neg
  except Exception:
    pass

  analysis['credit_summary'] = cs

  upsert_analysis(conn, report_id=report_id, result=analysis)


def _hydrate_analysis_dispute_letters(conn: psycopg.Connection, *, report_id: str) -> None:
  """Mirror latest letter drafts into analysis_json.dispute_letters for UI."""
  with conn.cursor() as cur:
    cur.execute(
      "select analysis_json from public.reports where id = %s;",
      (report_id,)
    )
    row = cur.fetchone()
  if not row or not row[0]:
    return

  analysis = row[0]
  if not isinstance(analysis, dict):
    return

  with conn.cursor() as cur:
    cur.execute(
      """
      select distinct on (bureau)
        id, bureau, content
      from public.letter_drafts
      where report_id = %s and status = 'draft'
      order by bureau, created_at desc;
      """,
      (report_id,)
    )
    drafts = cur.fetchall() or []

  items = []
  for _id, bureau, content in drafts:
    items.append(
      {
        'creditor_name': None,
        'subject': f"Draft dispute letter ({bureau})",
        'body': content
      }
    )
  analysis['dispute_letters'] = items

  upsert_analysis(conn, report_id=report_id, result=analysis)


def run_report_pipeline(
  *,
  conn: psycopg.Connection,
  report_id: str,
  download_fn,
  reports_bucket: str,
  storage_path: str,
  ocr_enabled: bool,
  tesseract_lang: str,
  upload_letters_fn,
  letters_bucket: str,
  business: dict[str, str]
) -> None:
  set_report_status(conn, report_id=report_id, status='processing', progress=1)

  with tempfile.TemporaryDirectory(prefix='credit-report-') as tmp:
    pdf_file = Path(tmp) / 'report.pdf'
    download_fn(bucket=reports_bucket, path=storage_path, dest=pdf_file)
    parse_pdf_to_pages(
      pdf_file=pdf_file,
      conn=conn,
      report_id=report_id,
      ocr_enabled=ocr_enabled,
      tesseract_lang=tesseract_lang
    )

    # Full UI-ready extraction into strict JSON structure.
    # This becomes the primary payload the frontend can render.
    try:
      client = OpenAIHttp(api_key=business.get('openai_api_key', ''), model=business.get('openai_model', 'gpt-4o-mini'))
      if client.api_key:
        set_report_status(conn, report_id=report_id, status='processing', progress=91)
        raw_text = _full_text(conn, report_id=report_id)
        ui_report = extract_ui_report(client=client, raw_text=raw_text)
        upsert_analysis(conn, report_id=report_id, result=ui_report)
        _overlay_extraction_metrics(conn, report_id=report_id, pdf_file=pdf_file)
        set_report_status(conn, report_id=report_id, status='processing', progress=93)
    except Exception as e:
      with conn.cursor() as cur:
        cur.execute(
          "update public.reports set error = left(coalesce(error,'') || '\nUI_EXTRACT: ' || %s, 4000) where id = %s;",
          (str(e), report_id)
        )

    # Always ensure we have a baseline UI payload even if OpenAI is disabled.
    if not _has_analysis_json(conn, report_id=report_id):
      upsert_analysis(conn, report_id=report_id, result=_basic_ui_payload(conn, report_id=report_id, pdf_file=pdf_file))
    _overlay_extraction_metrics(conn, report_id=report_id, pdf_file=pdf_file)

    # AI recommendations and initial draft selections (item-level engine).
    # Keep pipeline robust if AI is disabled or errors.
    try:
      client = OpenAIHttp(api_key=business.get('openai_api_key', ''), model=business.get('openai_model', 'gpt-4o-mini'))
      if client.api_key:
        set_report_status(conn, report_id=report_id, status='processing', progress=95)
        recommend_items_for_report(conn, report_id=report_id, client=client)
        set_report_status(conn, report_id=report_id, status='processing', progress=97)
    except Exception as e:
      with conn.cursor() as cur:
        cur.execute(
          "update public.reports set error = left(coalesce(error,'') || '\nAI_ITEMS: ' || %s, 4000) where id = %s;",
          (str(e), report_id)
        )

    # (analysis_json is now guaranteed non-null by the baseline writer above.)

    # Draft dispute letters as text files.
    # Letters are now drafts awaiting user approval (stored in DB).
    _generate_letter_drafts(conn, report_id=report_id, business=business)

    # Ensure dashboard has something to show in dispute queue.
    try:
      _hydrate_analysis_dispute_letters(conn, report_id=report_id)
    except Exception:
      pass

  set_report_status(conn, report_id=report_id, status='complete', progress=100)


def _generate_letter_drafts(conn: psycopg.Connection, *, report_id: str, business: dict[str, str]) -> None:
  # Pull selected items + AI snippets.
  with conn.cursor() as cur:
    cur.execute(
      """
      select
        i.bureau,
        i.category,
        i.creditor,
        i.account_ref,
        i.occurred_on,
        i.amount,
        i.page_number,
        a.letter_snippet,
        a.legal_basis,
        i.id
      from public.report_item_selection s
      join public.report_items i on i.id = s.item_id
      left join public.report_item_ai a on a.item_id = i.id
      where s.report_id = %s and s.selected = true
      order by coalesce(i.bureau,''), i.category, i.creditor;
      """,
      (report_id,)
    )
    rows = cur.fetchall() or []

  bureaus = ["Experian", "Equifax", "TransUnion"]
  for bureau in bureaus:
    bureau_rows = [r for r in rows if (r[0] == bureau or r[0] is None)]
    content, item_ids = _build_draft_letter(bureau=bureau, business=business, report_id=report_id, rows=bureau_rows)
    with conn.cursor() as cur:
      # Supersede prior drafts for this bureau.
      cur.execute(
        """
        update public.letter_drafts
        set status = 'superseded'
        where report_id = %s and bureau = %s and status = 'draft';
        """,
        (report_id, bureau)
      )
      cur.execute(
        """
        insert into public.letter_drafts (report_id, bureau, status, content, item_ids, model)
        values (%s, %s, 'draft', %s, %s::uuid[], %s);
        """,
        (report_id, bureau, content, item_ids, business.get('openai_model'))
      )


def _build_draft_letter(*, bureau: str, business: dict[str, str], report_id: str, rows) -> tuple[str, list[str]]:
  name = business.get('name', 'Your Company')
  address = business.get('address', 'Address line 1, City, ST ZIP')
  phone = business.get('phone', '(000) 000-0000')
  email = business.get('email', 'support@example.com')

  item_ids: list[str] = []
  lines: list[str] = [
    name,
    address,
    f"{phone} | {email}",
    "",
    "Date: __________",
    "",
    bureau,
    "Re: Dispute of potentially inaccurate information (draft)",
    f"Report ID: {report_id}",
    "",
    "To whom it may concern,",
    "",
    "I am requesting an investigation of information that may be inaccurate and/or unverifiable on my credit file. "
    "Please investigate the items listed below and delete or correct any information that cannot be verified.",
    "",
    "Items in dispute:",
    ""
  ]

  legal_seen: set[str] = set()
  for (
    _bureau,
    category,
    creditor,
    account_ref,
    occurred_on,
    amount,
    page_number,
    letter_snippet,
    legal_basis,
    item_id
  ) in rows:
    item_ids.append(str(item_id))

    head = f"- {str(category).replace('_',' ').title()}"
    if creditor:
      head += f" | {creditor}"
    lines.append(head)
    if account_ref:
      lines.append(f"  Account: {account_ref}")
    if occurred_on:
      lines.append(f"  Date: {occurred_on}")
    if amount is not None:
      lines.append(f"  Amount: ${amount}")
    if page_number:
      lines.append(f"  Reference: page {page_number}")
    if letter_snippet:
      lines.append(f"  {str(letter_snippet).strip()}")

    if legal_basis:
      try:
        for lb in legal_basis:
          key = f"{lb.get('law','')}|{lb.get('citation','')}"
          if key.strip() and key not in legal_seen:
            legal_seen.add(key)
      except Exception:
        pass
    lines.append("")

  if legal_seen:
    lines.append("Legal references (may apply):")
    for key in sorted(legal_seen):
      law, citation = key.split('|', 1)
      lines.append(f"- {law} {citation}")
    lines.append("")

  lines.extend(
    [
      "Please provide the results of your investigation and describe the method of verification used.",
      "",
      "Sincerely,",
      "__________________________",
      "Name",
      "Address",
      "City, State ZIP",
      ""
    ]
  )

  return ("\n".join(lines), item_ids)


def _build_dispute_letter(
  *,
  bureau: str,
  business: dict[str, str],
  report_id: str,
  items
) -> str:
  name = business.get('name', 'Your Company')
  address = business.get('address', 'Address line 1, City, ST ZIP')
  phone = business.get('phone', '(000) 000-0000')
  email = business.get('email', 'support@example.com')

  parts = [
    f"{name}",
    f"{address}",
    f"{phone} | {email}",
    "",
    "Date: __________",
    "",
    f"{bureau}",
    "Re: Dispute of inaccurate information",
    f"Report ID: {report_id}",
    "",
    "To whom it may concern,",
    "",
    "I am writing to dispute inaccurate and/or unverifiable information appearing on my credit file. "
    "Please investigate the items listed below and remove or correct any information that cannot be verified "
    "under the Fair Credit Reporting Act.",
    "",
    _items_block(report_id=report_id, items=items).rstrip(),
    "",
    "Enclosures: identification and supporting documentation (as applicable).",
    "",
    "Sincerely,",
    "__________________________",
    "{{FULL_NAME}}",
    "{{ADDRESS1}}",
    "{{ADDRESS2}}",
    "{{CITY}}, {{STATE}} {{POSTAL_CODE}}",
    ""
  ]

  return "\n".join(parts)


def _items_block(*, report_id: str, items) -> str:
  if not items:
    return "Items in dispute: (to be provided)\n\n"

  lines = ["Items in dispute:", ""]
  for bureau, category, creditor, account_ref, occurred_on, amount, page_number in items:
    parts = []
    parts.append(f"- {category.replace('_', ' ').title()}")
    if creditor:
      parts.append(f"  Creditor: {creditor}")
    if account_ref:
      parts.append(f"  Account: {account_ref}")
    if occurred_on:
      parts.append(f"  Date: {occurred_on}")
    if amount is not None:
      parts.append(f"  Amount: ${amount}")
    if page_number:
      parts.append(f"  Reference: Report {report_id}, page {page_number}")
    lines.extend(parts)
    lines.append("")

  return "\n".join(lines) + "\n"
