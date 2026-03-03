-- AI recommendations per extracted item + draft letters awaiting user approval.

create extension if not exists pgcrypto;

-- Per-item AI recommendation output.
create table if not exists public.report_item_ai (
  item_id uuid primary key references public.report_items (id) on delete cascade,
  recommendation text not null check (recommendation in ('dispute', 'do_not_dispute', 'needs_review')),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  rationale text not null default '',
  evidence_needed jsonb not null default '[]'::jsonb,
  legal_basis jsonb not null default '[]'::jsonb,
  letter_snippet text not null default '',
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  if not exists (select 1 from pg_trigger where tgname = 'report_item_ai_set_updated_at') then
    create trigger report_item_ai_set_updated_at
      before update on public.report_item_ai
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.report_item_ai enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='report_item_ai' and policyname='report_item_ai_select_own'
  ) then
    create policy report_item_ai_select_own on public.report_item_ai
      for select to authenticated
      using (
        exists (
          select 1
          from public.report_items i
          join public.reports r on r.id = i.report_id
          where i.id = item_id and r.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='report_item_ai' and policyname='report_item_ai_service_role_all'
  ) then
    create policy report_item_ai_service_role_all on public.report_item_ai
      for all to public
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- User selections for what to include.
create table if not exists public.report_item_selection (
  report_id uuid not null references public.reports (id) on delete cascade,
  item_id uuid not null references public.report_items (id) on delete cascade,
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (report_id, item_id)
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'report_item_selection_set_updated_at') then
    create trigger report_item_selection_set_updated_at
      before update on public.report_item_selection
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.report_item_selection enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='report_item_selection' and policyname='report_item_selection_own'
  ) then
    create policy report_item_selection_own on public.report_item_selection
      for all to authenticated
      using (exists (select 1 from public.reports r where r.id = report_id and r.user_id = auth.uid()))
      with check (exists (select 1 from public.reports r where r.id = report_id and r.user_id = auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='report_item_selection' and policyname='report_item_selection_service_role_all'
  ) then
    create policy report_item_selection_service_role_all on public.report_item_selection
      for all to public
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Draft letters awaiting approval.
create table if not exists public.letter_drafts (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  bureau text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded')),
  content text not null default '',
  item_ids uuid[] not null default '{}'::uuid[],
  model text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create index if not exists letter_drafts_report_idx
  on public.letter_drafts (report_id, bureau, created_at desc);

alter table public.letter_drafts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='letter_drafts' and policyname='letter_drafts_select_own'
  ) then
    create policy letter_drafts_select_own on public.letter_drafts
      for select to authenticated
      using (exists (select 1 from public.reports r where r.id = report_id and r.user_id = auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='letter_drafts' and policyname='letter_drafts_service_role_all'
  ) then
    create policy letter_drafts_service_role_all on public.letter_drafts
      for all to public
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
