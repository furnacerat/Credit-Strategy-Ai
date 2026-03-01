from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator
from urllib.parse import urlparse
import socket

import psycopg


def _can_resolve(host: str) -> bool:
  try:
    socket.getaddrinfo(host, None)
    return True
  except OSError:
    return False


@contextmanager
def connect(database_url: str) -> Iterator[psycopg.Connection]:
  host = urlparse(database_url).hostname
  if host and not _can_resolve(host):
    raise RuntimeError(
      "DATABASE_URL host does not resolve: "
      f"{host}. Copy the Postgres connection string from Supabase -> Settings -> Database "
      "(use the pooler URI if provided), then update DATABASE_URL and retry."
    )

  conn = psycopg.connect(database_url, autocommit=False)
  try:
    # Supabase enables RLS on our tables. When connecting over Postgres directly (pooler/direct),
    # there is no JWT by default, so auth.role() is null and policies can block the worker.
    # We explicitly set the request role to service_role for this session.
    with conn.cursor() as cur:
      cur.execute("select set_config('request.jwt.claim.role', 'service_role', true);")
      # Some auth helpers expect a sub; a dummy UUID is fine for service-role operations.
      cur.execute("select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);")
    conn.commit()
    yield conn
  finally:
    conn.close()
