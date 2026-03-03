from __future__ import annotations

import json
from typing import Any

from credit_worker.ai.openai_http import OpenAIHttp
from credit_worker.ai.report_schema import empty_report, ui_schema


def _system_prompt() -> str:
  # IMPORTANT: Root keys must match the frontend contract exactly.
  # Nested objects/arrays can evolve, but must not omit required root keys.
  return (
    "MASTER SYSTEM PROMPT (CREDIT REPORT INTELLIGENCE ENGINE)\n\n"
    "You are a Credit Report Intelligence Engine, not a chatbot.\n\n"
    "Your job is to:\n"
    "1. Extract ALL structured financial data from a credit report (PDF/text)\n"
    "2. Normalize and organize it into a strict schema\n"
    "3. Identify negative, disputable, and impactful items\n"
    "4. Generate high-value, personalized repair strategies\n"
    "5. Output UI-ready structured JSON + user-facing insights\n\n"
    "CORE RULES (CRITICAL)\n"
    "- DO NOT summarize vaguely\n"
    "- DO NOT skip incomplete data — infer structure when possible\n"
    "- DO NOT return plain text only\n"
    "- ALWAYS return structured JSON + insights\n"
    "- EVERYTHING must map to a UI component\n"
    "- If data is missing, return null — never omit fields\n\n"
    "OUTPUT CONTRACT\n"
    "- Return JSON only\n"
    "- Root keys MUST match exactly\n\n"
    "FRONTEND COMPONENT REQUIREMENTS\n"
    "Your JSON MUST support these UI components by providing UI-ready fields:\n"
    "- Dashboard: credit score gauge, utilization meter, negative items counter, score impact widget\n"
    "- Issue detection panel: negative accounts list, severity badges, fix-this actions\n"
    "- Dispute center: one-click letters, editable text, export metadata\n"
    "- Improvement tracker: checklist items, progress %, milestones\n"
    "- Account breakdown table: sortable/filterable flags (negative, open/closed, high utilization)\n\n"
    "EXPERIENCE LAYER\n"
    "Make the user feel: (1) this app understands my credit, (2) I know exactly what to fix, "
    "(3) I can take action immediately. Be specific and actionable in fields like priority_issues, "
    "dispute_strategies, and improvement_plan.\n\n"
    "PII HANDLING\n"
    "- In personal_info and accounts, keep sensitive identifiers masked when present (e.g., account number, SSN).\n"
    "- If a value would be unmasked PII, output null or a placeholder string like '{{FULL_NAME}}' for letters.\n\n"
    "Return JSON structured EXACTLY like this:\n"
    + json.dumps(empty_report(), ensure_ascii=True)
  )


def _user_prompt(text: str) -> str:
  return (
    "Input: raw extracted credit report text.\n"
    "Extract and normalize into the required JSON structure.\n\n"
    "RAW TEXT START\n"
    f"{text}\n"
    "RAW TEXT END\n"
  )


def _chunk_text(text: str, *, max_chars: int = 18000) -> list[str]:
  t = text.strip()
  if len(t) <= max_chars:
    return [t]

  chunks: list[str] = []
  start = 0
  overlap = 600
  while start < len(t):
    end = min(len(t), start + max_chars)
    chunks.append(t[start:end])
    start = end - overlap
    if start < 0:
      start = 0
    if end >= len(t):
      break
  return chunks


def _merge_reports(base: dict[str, Any], other: dict[str, Any]) -> dict[str, Any]:
  out = dict(base)
  # Objects: shallow merge with preference to non-empty.
  for k in ['personal_info', 'credit_summary', 'utilization', 'improvement_plan']:
    b = out.get(k) or {}
    o = other.get(k) or {}
    if isinstance(b, dict) and isinstance(o, dict):
      merged = dict(b)
      for kk, vv in o.items():
        if kk not in merged or merged.get(kk) in (None, '', [], {}):
          merged[kk] = vv
      out[k] = merged

  # Arrays: concat; downstream UI can tolerate duplicates for now.
  for k in [
    'accounts',
    'negative_items',
    'public_records',
    'priority_issues',
    'dispute_strategies',
    'dispute_letters'
  ]:
    a = out.get(k) or []
    b = other.get(k) or []
    if isinstance(a, list) and isinstance(b, list):
      out[k] = a + b

  return out


def extract_ui_report(*, client: OpenAIHttp, raw_text: str) -> dict[str, Any]:
  """Extract UI-ready JSON from raw credit report text.

  Uses chunking to keep requests bounded for large reports, then merges and
  runs a final normalization pass.
  """

  schema = ui_schema()
  system = _system_prompt()

  merged = empty_report()
  for chunk in _chunk_text(raw_text):
    rec = client.json_schema(system=system, user=_user_prompt(chunk), schema=schema)
    merged = _merge_reports(merged, rec)

  # Final normalization pass: give the merged JSON back and ask to dedupe/normalize.
  final_user = (
    "Normalize, dedupe, and compute any summary metrics you can. "
    "Do not drop fields; keep nulls when unknown.\n\n"
    f"MERGED_JSON: {json.dumps(merged, ensure_ascii=True)}"
  )
  final = client.json_schema(system=system, user=final_user, schema=schema)
  return final
