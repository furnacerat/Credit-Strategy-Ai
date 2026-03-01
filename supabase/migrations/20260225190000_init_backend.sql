-- Initial backend schema for credit report processing.

create extension if not exists pgcrypto;

-- Core status values for a report pipeline.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type report_status as enum (
      'uploaded',
      'queued',
      'processing',
      'complete',
      'failed'
    );
  end if;
end $$;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_bucket text not null default 'reports',
  storage_path text not null,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  status report_status not null default 'uploaded',
  progress int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reports_user_storage_path_uq
  on public.reports (user_id, storage_path);

create index if not exists reports_user_status_idx
  on public.reports (user_id, status, created_at desc);

create table if not exists public.report_pages (
  report_id uuid not null references public.reports (id) on delete cascade,
  page_number int not null,
  text text not null default '',
  ocr_used boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (report_id, page_number)
);

create table if not exists public.report_analysis (
  report_id uuid primary key references public.reports (id) on delete cascade,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dispute_letters (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  bureau text not null,
  storage_bucket text not null default 'letters',
  storage_path text not null,
  letter_text text,
  created_at timestamptz not null default now()
);

create index if not exists dispute_letters_report_idx
  on public.dispute_letters (report_id, created_at desc);

-- Minimal Postgres job queue table.
-- The worker claims jobs using SELECT ... FOR UPDATE SKIP LOCKED.
create table if not exists public.jobs (
  id bigint generated always as identity primary key,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued', -- queued | processing | complete | failed
  run_at timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 5,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_ready_idx
  on public.jobs (status, run_at, id);

-- Updated_at triggers.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'reports_set_updated_at') then
    create trigger reports_set_updated_at
      before update on public.reports
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'report_analysis_set_updated_at') then
    create trigger report_analysis_set_updated_at
      before update on public.report_analysis
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'jobs_set_updated_at') then
    create trigger jobs_set_updated_at
      before update on public.jobs
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- RLS
alter table public.reports enable row level security;
alter table public.report_pages enable row level security;
alter table public.report_analysis enable row level security;
alter table public.dispute_letters enable row level security;
alter table public.jobs enable row level security;

-- Authenticated users can manage their own reports.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='reports_select_own') then
    create policy reports_select_own on public.reports
      for select to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='reports_insert_own') then
    create policy reports_insert_own on public.reports
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='reports_update_own') then
    create policy reports_update_own on public.reports
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- Dependent tables restricted through parent report ownership.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='report_pages' and policyname='report_pages_select_own') then
    create policy report_pages_select_own on public.report_pages
      for select to authenticated
      using (exists (select 1 from public.reports r where r.id = report_id and r.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='report_analysis' and policyname='report_analysis_select_own') then
    create policy report_analysis_select_own on public.report_analysis
      for select to authenticated
      using (exists (select 1 from public.reports r where r.id = report_id and r.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dispute_letters' and policyname='dispute_letters_select_own') then
    create policy dispute_letters_select_own on public.dispute_letters
      for select to authenticated
      using (exists (select 1 from public.reports r where r.id = report_id and r.user_id = auth.uid()));
  end if;
end $$;

-- Service role can do everything (used by worker/server).
-- Note: these policies apply when requests carry a JWT with role=service_role (e.g. Supabase service key).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='reports_service_role_all') then
    create policy reports_service_role_all on public.reports
      for all to public
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='report_pages' and policyname='report_pages_service_role_all') then
    create policy report_pages_service_role_all on public.report_pages
      for all to public
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='report_analysis' and policyname='report_analysis_service_role_all') then
    create policy report_analysis_service_role_all on public.report_analysis
      for all to public
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dispute_letters' and policyname='dispute_letters_service_role_all') then
    create policy dispute_letters_service_role_all on public.dispute_letters
      for all to public
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='jobs' and policyname='jobs_service_role_all') then
    create policy jobs_service_role_all on public.jobs
      for all to public
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
