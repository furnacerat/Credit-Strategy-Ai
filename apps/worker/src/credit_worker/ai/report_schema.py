from __future__ import annotations

from typing import Any


def ui_schema() -> dict[str, Any]:
  """JSON schema for the UI-ready report object.

  Root keys are strict and must exist. Nested contents are flexible to allow
  iterative enrichment without breaking the contract.
  """

  flexible_obj: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': True
  }

  flexible_array_obj: dict[str, Any] = {
    'type': 'array',
    'items': flexible_obj
  }

  return {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
      'personal_info': flexible_obj,
      'credit_summary': flexible_obj,
      'accounts': flexible_array_obj,
      'negative_items': flexible_array_obj,
      'utilization': flexible_obj,
      'public_records': flexible_array_obj,
      'priority_issues': flexible_array_obj,
      'dispute_strategies': flexible_array_obj,
      'dispute_letters': flexible_array_obj,
      'improvement_plan': flexible_obj
    },
    'required': [
      'personal_info',
      'credit_summary',
      'accounts',
      'negative_items',
      'utilization',
      'public_records',
      'priority_issues',
      'dispute_strategies',
      'dispute_letters',
      'improvement_plan'
    ]
  }


def empty_report() -> dict[str, Any]:
  return {
    'personal_info': {},
    'credit_summary': {},
    'accounts': [],
    'negative_items': [],
    'utilization': {},
    'public_records': [],
    'priority_issues': [],
    'dispute_strategies': [],
    'dispute_letters': [],
    'improvement_plan': {}
  }
