from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import re
from typing import Iterable


@dataclass(frozen=True)
class ReportItem:
  category: str
  bureau: str | None
  creditor: str | None
  account_ref: str | None
  occurred_on: date | None
  amount: float | None
  confidence: float
  page_number: int
  raw_text: str


_DATE_MMDDYYYY = re.compile(r"\b(0?[1-9]|1[0-2])/(0?[1-9]|[12]\d|3[01])/(19\d\d|20\d\d)\b")
_AMOUNT = re.compile(r"\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)")
_ACCOUNT_REF = re.compile(
  r"\b(?:account|acct)\s*(?:number|no\.?|#)?\s*[:\-]?\s*([xX*•\-]{0,16}\d{3,6})\b"
)


def _parse_date(text: str) -> date | None:
  m = _DATE_MMDDYYYY.search(text)
  if not m:
    return None
  mm, dd, yyyy = int(m.group(1)), int(m.group(2)), int(m.group(3))
  try:
    return date(yyyy, mm, dd)
  except ValueError:
    return None


def _parse_amount(text: str) -> float | None:
  m = _AMOUNT.search(text)
  if not m:
    return None
  try:
    return float(m.group(1).replace(",", ""))
  except ValueError:
    return None


def _parse_account_ref(text: str) -> str | None:
  m = _ACCOUNT_REF.search(text)
  if not m:
    return None
  return m.group(1)


def _guess_bureau(page_text: str) -> str | None:
  t = page_text.lower()
  if "experian" in t:
    return "Experian"
  if "equifax" in t:
    return "Equifax"
  if "transunion" in t or "trans union" in t:
    return "TransUnion"
  return None


def _guess_creditor(snippet: str) -> str | None:
  # Heuristic: first non-empty line that isn't a header and is mostly letters.
  for line in snippet.splitlines():
    l = line.strip()
    if not l:
      continue
    if len(l) > 60:
      continue
    low = l.lower()
    if any(x in low for x in ["account", "payment", "balance", "inquiry", "collection", "charge off"]):
      continue
    letters = sum(ch.isalpha() for ch in l)
    if letters >= max(6, int(len(l) * 0.5)):
      return l[:60]
  return None


def iter_report_items(*, page_number: int, page_text: str) -> Iterable[ReportItem]:
  """Extract dispute-relevant items from a page.

  This is an MVP heuristic parser. It is designed to be safe (not crash) and to
  produce a structured list we can iterate on per bureau format.
  """
  bureau = _guess_bureau(page_text)

  patterns: list[tuple[str, re.Pattern[str], float]] = [
    ("charge_off", re.compile(r"\bcharge\s*off\b", re.I), 0.75),
    ("collection", re.compile(r"\bcollection\b|\bcollections\b", re.I), 0.65),
    ("late_payment", re.compile(r"\b(30|60|90|120)\s*days\s*late\b|\blate\s*payment\b", re.I), 0.7),
    ("repossession", re.compile(r"\brepossess", re.I), 0.7),
    ("bankruptcy", re.compile(r"\bbankrupt", re.I), 0.7),
    ("public_record", re.compile(r"\bpublic\s*record\b|\bcivil\s*judg", re.I), 0.55),
    ("inquiry", re.compile(r"\b(inquiry|inquiries)\b", re.I), 0.35)
  ]

  # Scan the page for each pattern; for each match, capture a snippet.
  for category, rx, conf in patterns:
    for m in rx.finditer(page_text):
      start = max(0, m.start() - 240)
      end = min(len(page_text), m.end() + 260)
      snippet = page_text[start:end].strip()
      creditor = _guess_creditor(snippet)
      account_ref = _parse_account_ref(snippet)
      occurred_on = _parse_date(snippet)
      amount = _parse_amount(snippet)

      yield ReportItem(
        category=category,
        bureau=bureau,
        creditor=creditor,
        account_ref=account_ref,
        occurred_on=occurred_on,
        amount=amount,
        confidence=conf,
        page_number=page_number,
        raw_text=snippet
      )
