from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import httpx


@dataclass(frozen=True)
class StorageHttp:
  supabase_url: str
  service_role_key: str

  def _headers(self) -> dict[str, str]:
    return {
      'authorization': f'Bearer {self.service_role_key}',
      'apikey': self.service_role_key
    }

  def download_object_to_file(self, *, bucket: str, path: str, dest: Path) -> None:
    url = f"{self.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{path.lstrip('/')}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=None) as client:
      with client.stream('GET', url, headers=self._headers()) as r:
        r.raise_for_status()
        with dest.open('wb') as f:
          for chunk in r.iter_bytes():
            if chunk:
              f.write(chunk)

  def upload_bytes(self, *, bucket: str, path: str, content: bytes, content_type: str) -> None:
    url = f"{self.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{path.lstrip('/')}"
    headers = self._headers() | {'content-type': content_type}
    with httpx.Client(timeout=None) as client:
      r = client.post(url, headers=headers, content=content)
      r.raise_for_status()
