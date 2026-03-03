from __future__ import annotations

from typing import Any


def _get(obj: dict[str, Any], key: str, default: Any) -> Any:
  v = obj.get(key)
  return default if v is None else v


def normalize_ui_report(report: dict[str, Any]) -> dict[str, Any]:
  """Fill common UI metrics when missing.

  This does not invent facts; it only derives totals/ratios from extracted
  structures when possible.
  """

  out = dict(report or {})

  credit_summary = dict(out.get('credit_summary') or {})
  utilization = dict(out.get('utilization') or {})
  accounts = out.get('accounts') or []
  negative_items = out.get('negative_items') or []

  if not isinstance(accounts, list):
    accounts = []
  if not isinstance(negative_items, list):
    negative_items = []

  # totals
  if credit_summary.get('total_accounts') in (None, '', 0):
    credit_summary['total_accounts'] = len(accounts) if accounts else credit_summary.get('total_accounts')

  if credit_summary.get('negative_accounts_count') in (None, '', 0):
    credit_summary['negative_accounts_count'] = len(negative_items) if negative_items else credit_summary.get('negative_accounts_count')

  # counts from negative_items if missing
  if credit_summary.get('counts') in (None, {}, []):
    counts: dict[str, int] = {}
    for it in negative_items:
      if not isinstance(it, dict):
        continue
      cat = it.get('category') or it.get('type')
      if not isinstance(cat, str) or not cat.strip():
        continue
      key = cat.strip().lower().replace(' ', '_')
      counts[key] = counts.get(key, 0) + 1
    credit_summary['counts'] = counts or None

  # utilization
  total_limit = utilization.get('total_credit_limit')
  total_balance = utilization.get('total_balance')
  util_pct = utilization.get('utilization_percentage')

  # Derive totals from per-account if present
  per = utilization.get('per_account')
  if (total_limit is None or total_balance is None) and isinstance(per, list):
    lim = 0.0
    bal = 0.0
    any_val = False
    for row in per:
      if not isinstance(row, dict):
        continue
      cl = row.get('credit_limit')
      cb = row.get('balance')
      if isinstance(cl, (int, float)):
        lim += float(cl)
        any_val = True
      if isinstance(cb, (int, float)):
        bal += float(cb)
        any_val = True
    if any_val:
      if total_limit is None:
        utilization['total_credit_limit'] = lim
        total_limit = lim
      if total_balance is None:
        utilization['total_balance'] = bal
        total_balance = bal

  if util_pct is None and isinstance(total_limit, (int, float)) and float(total_limit) > 0 and isinstance(total_balance, (int, float)):
    utilization['utilization_percentage'] = round((float(total_balance) / float(total_limit)) * 100.0, 2)

  # Ensure keys exist so the UI never has to guess.
  credit_summary.setdefault('score', None)
  credit_summary.setdefault('estimated_score_range', None)
  credit_summary.setdefault('on_time_payment_ratio', None)
  credit_summary.setdefault('oldest_account_age', None)

  utilization.setdefault('total_credit_limit', None)
  utilization.setdefault('total_balance', None)
  utilization.setdefault('utilization_percentage', None)
  utilization.setdefault('per_account', None)

  out['credit_summary'] = credit_summary
  out['utilization'] = utilization
  out['accounts'] = accounts
  out['negative_items'] = negative_items

  # Root keys must exist (defensive)
  out.setdefault('personal_info', {})
  out.setdefault('public_records', [])
  out.setdefault('priority_issues', [])
  out.setdefault('dispute_strategies', [])
  out.setdefault('dispute_letters', [])
  out.setdefault('improvement_plan', {})

  return out
