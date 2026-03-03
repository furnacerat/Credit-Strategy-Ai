# Backend setup (Supabase + Worker)

## What gets deployed where

- Vercel: `apps/web/` (Next.js)
- Render: `apps/worker/` (Python worker)
- Supabase: Postgres + Storage buckets + RLS

## Supabase

1) Run SQL migration

- Apply `supabase/migrations/20260225190000_init_backend.sql` in the Supabase SQL editor.

2) Create Storage buckets

- `reports` (private)
- `letters` (private)

## Vercel env vars (web)

Set these in Vercel for the Next.js project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_REPORTS_BUCKET=reports` (optional)

Do not commit secrets. Set them in Vercel project settings.

Local dev: this repo now includes `apps/web/.env.local` (gitignored by default patterns).

## Render env vars (worker)

Set these in Render for the worker service:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` (Supabase Postgres connection string; include `?sslmode=require`)
- `SUPABASE_REPORTS_BUCKET=reports`
- `SUPABASE_LETTERS_BUCKET=letters`
- `OCR_ENABLED=true`
- `TESSERACT_LANG=eng`

AI:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4o-mini`)

Recommended: deploy worker using `apps/worker/Dockerfile` (includes Tesseract).

Local dev: this repo now includes `apps/worker/.env` (gitignored by default patterns).

## API endpoints

- `POST /api/reports/initiate`
  - Requires: `Authorization: Bearer <supabase_access_token>`
  - Body: `{ "filename": "report.pdf", "mime_type": "application/pdf", "size_bytes": 123 }`
  - Returns: `{ report_id, bucket, path, signed_upload }`

The client uploads the PDF directly to Storage using the returned signed upload.

- `POST /api/reports/enqueue`
  - Requires: `Authorization: Bearer <supabase_access_token>`
  - Body: `{ "report_id": "..." }`
  - Enqueues the parse job after upload completes.

Then the worker picks up the queued `parse_report` job from `public.jobs`.
