-- Store structured findings extracted from a report.

create extension if not exists pgcrypto;

create table if not exists public.report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  bureau text,
  category text not null,
  creditor text,
  account_ref text,
  occurred_on date,
  amount numeric,
  confidence real not null default 0.5,
  page_number int,
  raw_text text,
  created_at timestamptz not null default now()
);

create index if not exists report_items_report_idx
  on public.report_items (report_id, category, created_at desc);

alter table public.report_items enable row level security;

-- Users can select their own report items via parent report ownership.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='report_items' and policyname='report_items_select_own'
  ) then
    create policy report_items_select_own on public.report_items
      for select to authenticated
      using (exists (select 1 from public.reports r where r.id = report_id and r.user_id = auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='report_items' and policyname='report_items_service_role_all'
  ) then
    create policy report_items_service_role_all on public.report_items
      for all to public
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
