from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import psycopg


@dataclass(frozen=True)
class Job:
  id: int
  type: str
  payload: dict[str, Any]


def fetch_and_lock_next_job(conn: psycopg.Connection, *, worker_id: str) -> Job | None:
  """Atomically claim the next ready job.

  Uses FOR UPDATE SKIP LOCKED so multiple workers can run concurrently.
  """
  with conn.cursor() as cur:
    cur.execute(
      """
      with next_job as (
        select id
        from public.jobs
        where status = 'queued' and run_at <= now()
        order by id
        for update skip locked
        limit 1
      )
      update public.jobs j
      set
        status = 'processing',
        locked_at = now(),
        locked_by = %s,
        attempts = attempts + 1,
        updated_at = now()
      from next_job
      where j.id = next_job.id
      returning j.id, j.type, j.payload;
      """,
      (worker_id,)
    )
    row = cur.fetchone()
    if not row:
      return None
    job_id, job_type, payload = row
    return Job(id=int(job_id), type=str(job_type), payload=payload)


def mark_job_complete(conn: psycopg.Connection, job_id: int) -> None:
  with conn.cursor() as cur:
    cur.execute(
      """
      update public.jobs
      set status = 'complete', updated_at = now()
      where id = %s;
      """,
      (job_id,)
    )


def mark_job_failed(conn: psycopg.Connection, job_id: int, *, error: str) -> None:
  with conn.cursor() as cur:
    cur.execute(
      """
      update public.jobs
      set
        status = case when attempts >= max_attempts then 'failed' else 'queued' end,
        last_error = left(%s, 4000),
        run_at = case when attempts >= max_attempts then run_at else now() + interval '30 seconds' end,
        updated_at = now()
      where id = %s;
      """,
      (error, job_id)
    )
