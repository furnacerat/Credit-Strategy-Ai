from __future__ import annotations

from dataclasses import dataclass
import os


def _env(name: str, default: str | None = None) -> str:
  value = os.getenv(name, default)
  if value is None or value == '':
    raise RuntimeError(f"Missing required env var: {name}")
  return value


def _env_bool(name: str, default: str = 'false') -> bool:
  return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
  database_url: str
  supabase_url: str
  supabase_service_role_key: str
  reports_bucket: str
  letters_bucket: str
  ocr_enabled: bool
  tesseract_lang: str
  worker_id: str
  job_poll_interval_s: float
  business_name: str
  business_address: str
  business_phone: str
  business_email: str


def load_settings() -> Settings:
  database_url = _env('DATABASE_URL')
  # Supabase hosted Postgres requires SSL.
  if 'sslmode=' not in database_url:
    database_url = database_url + ('&' if '?' in database_url else '?') + 'sslmode=require'

  return Settings(
    database_url=database_url,
    supabase_url=_env('SUPABASE_URL'),
    supabase_service_role_key=_env('SUPABASE_SERVICE_ROLE_KEY'),
    reports_bucket=os.getenv('SUPABASE_REPORTS_BUCKET', 'reports'),
    letters_bucket=os.getenv('SUPABASE_LETTERS_BUCKET', 'letters'),
    ocr_enabled=_env_bool('OCR_ENABLED', 'true'),
    tesseract_lang=os.getenv('TESSERACT_LANG', 'eng'),
    worker_id=os.getenv('WORKER_ID', 'worker-1'),
    job_poll_interval_s=float(os.getenv('JOB_POLL_INTERVAL_S', '1.0')),
    business_name=os.getenv('BUSINESS_NAME', 'Your Company'),
    business_address=os.getenv('BUSINESS_ADDRESS', 'Address line 1, City, ST ZIP'),
    business_phone=os.getenv('BUSINESS_PHONE', '(000) 000-0000'),
    business_email=os.getenv('BUSINESS_EMAIL', 'support@example.com')
  )
