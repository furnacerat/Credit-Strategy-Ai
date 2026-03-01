# pyright: reportMissingImports=false, reportMissingTypeStubs=false

from __future__ import annotations

from pathlib import Path
import tempfile
from typing import Any
import json

import psycopg

from credit_worker.pdf.real_extract import extract_text_pages, page_count


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


def upsert_analysis(conn: psycopg.Connection, *, report_id: str, result: dict[str, Any]) -> None:
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
    progress = int((idx / total) * 90)
    set_report_status(conn, report_id=report_id, status='processing', progress=progress)


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

    # Basic analysis (placeholder until we parse tradelines/collections/inquiries).
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

    analysis = {
      "report_id": report_id,
      "pages": total_pages,
      "ocr_pages": ocr_pages,
      "total_chars": total_chars
    }
    upsert_analysis(conn, report_id=report_id, result=analysis)

    # Draft dispute letters as text files.
    bureaus = ["Experian", "Equifax", "TransUnion"]
    for bureau in bureaus:
      letter_text = _build_dispute_letter(
        bureau=bureau,
        business=business,
        report_id=report_id
      )
      letter_path = f"{report_id}/{bureau.lower()}-dispute-letter.txt"
      upload_letters_fn(
        bucket=letters_bucket,
        path=letter_path,
        content=letter_text.encode('utf-8'),
        content_type='text/plain; charset=utf-8'
      )
      insert_letter(
        conn,
        report_id=report_id,
        bureau=bureau,
        storage_bucket=letters_bucket,
        storage_path=letter_path,
        letter_text=letter_text
      )

  set_report_status(conn, report_id=report_id, status='complete', progress=100)


def _build_dispute_letter(*, bureau: str, business: dict[str, str], report_id: str) -> str:
  name = business.get('name', 'Your Company')
  address = business.get('address', 'Address line 1, City, ST ZIP')
  phone = business.get('phone', '(000) 000-0000')
  email = business.get('email', 'support@example.com')

  return (
    f"{name}\n"
    f"{address}\n"
    f"{phone} | {email}\n\n"
    f"Date: __________\n\n"
    f"{bureau}\n"
    f"Re: Dispute of inaccurate information\n"
    f"Report ID: {report_id}\n\n"
    "To whom it may concern,\n\n"
    "I am writing to dispute inaccurate and/or unverifiable information appearing on my credit file. "
    "Please investigate the items in question and remove or correct any information that cannot be verified "
    "under the Fair Credit Reporting Act.\n\n"
    "Enclosures: identification and supporting documentation (as applicable).\n\n"
    "Sincerely,\n"
    "__________________________\n"
    "Name\n"
    "Address\n"
    "City, State ZIP\n"
  )
