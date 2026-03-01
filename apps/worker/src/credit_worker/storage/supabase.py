"""Supabase Storage helpers.

We'll use signed URLs for downloads in the worker, and direct client uploads from web.
"""

from __future__ import annotations


class SupabaseStorage:
  def __init__(self, *, supabase_url: str, service_role_key: str, bucket: str) -> None:
    self.supabase_url = supabase_url
    self.service_role_key = service_role_key
    self.bucket = bucket
