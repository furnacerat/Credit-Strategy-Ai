from __future__ import annotations

from typing import Any


def ui_schema() -> dict[str, Any]:
  """JSON schema for the UI-ready report object.

  Root keys are strict and must exist. Nested contents are flexible to allow
  iterative enrichment without breaking the contract.
  """

  flexible_obj: dict[str, Any] = {'type': 'object', 'additionalProperties': True}

  flexible_array_obj: dict[str, Any] = {
    'type': 'array',
    'items': flexible_obj
  }

  credit_summary: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': True,
    'properties': {
      'score': {'type': ['number', 'null'], 'description': 'Credit score when present (300-850).'},
      'estimated_score_range': {'type': ['string', 'null']},
      'total_accounts': {'type': ['integer', 'null']},
      'negative_accounts_count': {'type': ['integer', 'null']},
      'on_time_payment_ratio': {'type': ['number', 'null'], 'description': '0-1 ratio when derivable.'},
      'oldest_account_age': {'type': ['string', 'null']},
      'counts': {
        'type': ['object', 'null'],
        'additionalProperties': {'type': 'integer'}
      }
    },
    'required': [
      'score',
      'estimated_score_range',
      'total_accounts',
      'negative_accounts_count',
      'on_time_payment_ratio',
      'oldest_account_age',
      'counts'
    ]
  }

  utilization: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': True,
    'properties': {
      'total_credit_limit': {'type': ['number', 'null']},
      'total_balance': {'type': ['number', 'null']},
      'utilization_percentage': {'type': ['number', 'null']},
      'per_account': {
        'type': ['array', 'null'],
        'items': {
          'type': 'object',
          'additionalProperties': True,
          'properties': {
            'creditor_name': {'type': ['string', 'null']},
            'utilization_percentage': {'type': ['number', 'null']},
            'balance': {'type': ['number', 'null']},
            'credit_limit': {'type': ['number', 'null']}
          }
        }
      }
    },
    'required': ['total_credit_limit', 'total_balance', 'utilization_percentage', 'per_account']
  }

  accounts: dict[str, Any] = {
    'type': 'array',
    'items': {
      'type': 'object',
      'additionalProperties': True,
      'properties': {
        'creditor_name': {'type': ['string', 'null']},
        'bureau': {'type': ['string', 'null']},
        'account_type': {'type': ['string', 'null']},
        'status': {'type': ['string', 'null']},
        'payment_status': {'type': ['string', 'null']},
        'balance': {'type': ['number', 'null']},
        'credit_limit': {'type': ['number', 'null']},
        'high_balance': {'type': ['number', 'null']},
        'past_due_amount': {'type': ['number', 'null']},
        'late_payments': {
          'type': ['object', 'null'],
          'additionalProperties': True
        },
        'derogatory_flag': {'type': ['boolean', 'null']},
        'charge_off_flag': {'type': ['boolean', 'null']},
        'collection_flag': {'type': ['boolean', 'null']},
        'date_opened': {'type': ['string', 'null']},
        'last_activity_date': {'type': ['string', 'null']}
      }
    }
  }

  negative_items: dict[str, Any] = {
    'type': 'array',
    'items': {
      'type': 'object',
      'additionalProperties': True,
      'properties': {
        'category': {'type': ['string', 'null']},
        'type': {'type': ['string', 'null']},
        'bureau': {'type': ['string', 'null']},
        'creditor_name': {'type': ['string', 'null']},
        'account_number': {'type': ['string', 'null']},
        'occurred_on': {'type': ['string', 'null']},
        'amount': {'type': ['number', 'null']},
        'page_number': {'type': ['integer', 'null']},
        'severity_score': {'type': ['number', 'null']},
        'estimated_score_impact': {'type': ['string', 'null']},
        'dispute_recommendation': {'type': ['string', 'null']}
      }
    }
  }

  return {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
      'personal_info': flexible_obj,
      'credit_summary': credit_summary,
      'accounts': accounts,
      'negative_items': negative_items,
      'utilization': utilization,
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
    'credit_summary': {
      'score': None,
      'estimated_score_range': None,
      'total_accounts': None,
      'negative_accounts_count': None,
      'on_time_payment_ratio': None,
      'oldest_account_age': None,
      'counts': None
    },
    'accounts': [],
    'negative_items': [],
    'utilization': {
      'total_credit_limit': None,
      'total_balance': None,
      'utilization_percentage': None,
      'per_account': None
    },
    'public_records': [],
    'priority_issues': [],
    'dispute_strategies': [],
    'dispute_letters': [],
    'improvement_plan': {}
  }
