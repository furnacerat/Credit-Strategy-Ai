from __future__ import annotations

from dataclasses import asdict
import json
from typing import Any

import psycopg

from credit_worker.ai.openai_http import OpenAIHttp


_SCHEMA: dict[str, Any] = {
  'type': 'object',
  'additionalProperties': False,
  'properties': {
    'recommendation': {
      'type': 'string',
      'enum': ['dispute', 'do_not_dispute', 'needs_review']
    },
    'risk_level': {
      'type': 'string',
      'enum': ['low', 'medium', 'high']
    },
    'rationale': {'type': 'string'},
    'evidence_needed': {'type': 'array', 'items': {'type': 'string'}},
    'legal_basis': {
      'type': 'array',
      'items': {
        'type': 'object',
        'additionalProperties': False,
        'properties': {
          'law': {'type': 'string'},
          'citation': {'type': 'string'},
          'why': {'type': 'string'}
        },
        'required': ['law', 'citation', 'why']
      }
    },
    'letter_snippet': {'type': 'string'}
  },
  'required': ['recommendation', 'risk_level', 'rationale', 'evidence_needed', 'legal_basis', 'letter_snippet']
}


def _system_prompt() -> str:
  return (
    "You are a cautious, compliance-minded credit report analyst. "
    "You help draft dispute letter language, but you must not provide legal advice, "
    "must not guarantee outcomes, and must avoid instructing wrongdoing. "
    "Prefer 'needs_review' when information is insufficient. "
    "Cite U.S. federal laws only when relevant and phrase them as 'may apply'."
  )


def _user_prompt(item: dict[str, Any]) -> str:
  return (
    "Analyze this extracted credit report item and recommend whether to include it in a dispute letter.\n\n"
    "Return JSON that matches the schema exactly.\n\n"
    f"Item: {json.dumps(item, ensure_ascii=True)}\n\n"
    "Guidelines:\n"
    "- If the item is merely a heading (e.g., 'Inquiries') without a specific entry, choose needs_review.\n"
    "- If the snippet does not contain a specific creditor/account reference, choose needs_review.\n"
    "- If recommending dispute, provide a short, item-specific snippet suitable for a letter bullet.\n"
    "- Legal basis may include: FCRA 15 U.S.C. 1681i (investigation), 1681s-2 (furnisher duties), "
    "and FDCPA 15 U.S.C. 1692 if a debt collector is implicated. Only include what fits.\n"
  )


def upsert_item_ai(
  conn: psycopg.Connection,
  *,
  item_id: str,
  rec: dict[str, Any],
  model: str
) -> None:
  with conn.cursor() as cur:
    cur.execute(
      """
      insert into public.report_item_ai
        (item_id, recommendation, risk_level, rationale, evidence_needed, legal_basis, letter_snippet, model)
      values
        (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s)
      on conflict (item_id)
      do update set
        recommendation = excluded.recommendation,
        risk_level = excluded.risk_level,
        rationale = excluded.rationale,
        evidence_needed = excluded.evidence_needed,
        legal_basis = excluded.legal_basis,
        letter_snippet = excluded.letter_snippet,
        model = excluded.model,
        updated_at = now();
      """,
      (
        item_id,
        rec['recommendation'],
        rec['risk_level'],
        rec.get('rationale', ''),
        json.dumps(rec.get('evidence_needed', []), ensure_ascii=True),
        json.dumps(rec.get('legal_basis', []), ensure_ascii=True),
        rec.get('letter_snippet', ''),
        model
      )
    )


def ensure_selection_row(
  conn: psycopg.Connection,
  *,
  report_id: str,
  item_id: str,
  selected: bool
) -> None:
  with conn.cursor() as cur:
    cur.execute(
      """
      insert into public.report_item_selection (report_id, item_id, selected)
      values (%s, %s, %s)
      on conflict (report_id, item_id)
      do nothing;
      """,
      (report_id, item_id, selected)
    )


def recommend_items_for_report(
  conn: psycopg.Connection,
  *,
  report_id: str,
  client: OpenAIHttp
) -> None:
  with conn.cursor() as cur:
    cur.execute(
      """
      select id, bureau, category, creditor, account_ref, occurred_on, amount, confidence, page_number, raw_text
      from public.report_items
      where report_id = %s
      order by created_at asc;
      """,
      (report_id,)
    )
    rows = cur.fetchall() or []

  for (
    item_id,
    bureau,
    category,
    creditor,
    account_ref,
    occurred_on,
    amount,
    confidence,
    page_number,
    raw_text
  ) in rows:
    item = {
      'report_id': report_id,
      'bureau': bureau,
      'category': category,
      'creditor': creditor,
      'account_ref': account_ref,
      'occurred_on': str(occurred_on) if occurred_on else None,
      'amount': float(amount) if amount is not None else None,
      'confidence': float(confidence) if confidence is not None else 0.0,
      'page_number': page_number,
      'raw_text': (raw_text or '')[:1200]
    }

    rec = client.json_schema(
      system=_system_prompt(),
      user=_user_prompt(item),
      schema=_SCHEMA
    )

    upsert_item_ai(conn, item_id=str(item_id), rec=rec, model=client.model)

    # Default selection: select items recommended for dispute.
    ensure_selection_row(
      conn,
      report_id=report_id,
      item_id=str(item_id),
      selected=(rec.get('recommendation') == 'dispute')
    )
