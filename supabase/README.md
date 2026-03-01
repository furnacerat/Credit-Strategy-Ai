# Supabase

We'll store migrations/policies here as we build out:

- Storage bucket (`reports`) with private access
- RLS policies for per-user access
- Job tables/queue tables

## Migrations

- `supabase/migrations/20260225190000_init_backend.sql` creates:
  - `public.reports`
  - `public.report_pages`
  - `public.report_analysis`
  - `public.dispute_letters`
  - `public.jobs`

## Storage

Planned buckets:

- `reports` (private) - uploaded PDFs
- `letters` (private) - generated letters
