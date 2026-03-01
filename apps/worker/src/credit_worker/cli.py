def main() -> None:
  from dotenv import load_dotenv
  from pathlib import Path

  from credit_worker.config import load_settings
  from credit_worker.db import connect
  from credit_worker.queue import fetch_and_lock_next_job, mark_job_complete, mark_job_failed
  from credit_worker.storage_http import StorageHttp
  from credit_worker.pipeline import run_report_pipeline
  import time

  # Load `.env` from the worker project folder so `credit-worker` can be run
  # from any current working directory.
  project_env = Path(__file__).resolve().parents[2] / '.env'
  if project_env.exists():
    load_dotenv(project_env)
  else:
    load_dotenv()
  s = load_settings()
  storage = StorageHttp(supabase_url=s.supabase_url, service_role_key=s.supabase_service_role_key)

  print(f"credit-worker: start worker_id={s.worker_id}")
  while True:
    try:
      with connect(s.database_url) as conn:
        job = fetch_and_lock_next_job(conn, worker_id=s.worker_id)
        if not job:
          conn.commit()
          time.sleep(s.job_poll_interval_s)
          continue

        try:
          print(f"credit-worker: job id={job.id} type={job.type}")
          if job.type == 'parse_report':
            report_id = str(job.payload['report_id'])
            storage_path = str(job.payload['storage_path'])
            run_report_pipeline(
              conn=conn,
              report_id=report_id,
              download_fn=storage.download_object_to_file,
              reports_bucket=s.reports_bucket,
              storage_path=storage_path,
              ocr_enabled=s.ocr_enabled,
              tesseract_lang=s.tesseract_lang,
              upload_letters_fn=storage.upload_bytes,
              letters_bucket=s.letters_bucket,
              business={
                'name': s.business_name,
                'address': s.business_address,
                'phone': s.business_phone,
                'email': s.business_email
              }
            )
          else:
            raise RuntimeError(f"Unknown job type: {job.type}")

          mark_job_complete(conn, job.id)
          conn.commit()
          print(f"credit-worker: job id={job.id} complete")
        except Exception as e:
          mark_job_failed(conn, job.id, error=str(e))
          conn.commit()
          print(f"credit-worker: job id={job.id} failed: {e}")
    except Exception as e:
      print(f"credit-worker: loop error: {e}")
      time.sleep(max(2.0, s.job_poll_interval_s))
