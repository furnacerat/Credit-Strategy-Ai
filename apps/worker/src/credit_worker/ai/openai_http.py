from __future__ import annotations

import json
from typing import Any

import httpx


class OpenAIHttp:
  def __init__(self, *, api_key: str, model: str) -> None:
    self.api_key = api_key
    self.model = model

  def _headers(self) -> dict[str, str]:
    return {
      'authorization': f'Bearer {self.api_key}',
      'content-type': 'application/json'
    }

  def json_schema(self, *, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]:
    if not self.api_key:
      raise RuntimeError('OPENAI_API_KEY is not set')

    payload = {
      'model': self.model,
      'input': [
        {'role': 'system', 'content': system},
        {'role': 'user', 'content': user}
      ],
      'response_format': {
        'type': 'json_schema',
        'json_schema': {
          'name': 'report_item_recommendation',
          'schema': schema,
          'strict': True
        }
      }
    }

    with httpx.Client(timeout=90.0) as client:
      r = client.post('https://api.openai.com/v1/responses', headers=self._headers(), content=json.dumps(payload))
      r.raise_for_status()
      data = r.json()

    # Responses API returns content blocks; we take the first output_text.
    out = data.get('output', [])
    text = None
    for item in out:
      for c in item.get('content', []) if isinstance(item, dict) else []:
        if c.get('type') == 'output_text':
          text = c.get('text')
          break
      if text:
        break

    if not text:
      raise RuntimeError('OpenAI response missing output_text')

    return json.loads(text)
