-- Profiles (one-time PII form) + finalized letter metadata.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  address1 text not null default '',
  address2 text not null default '',
  city text not null default '',
  state text not null default '',
  postal_code text not null default '',
  phone text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_set_updated_at') then
    create trigger profiles_set_updated_at
      before update on public.profiles
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_select_own'
  ) then
    create policy profiles_select_own on public.profiles
      for select to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_insert_own'
  ) then
    create policy profiles_insert_own on public.profiles
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_update_own'
  ) then
    create policy profiles_update_own on public.profiles
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_service_role_all'
  ) then
    create policy profiles_service_role_all on public.profiles
      for all to public
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Finalized letter metadata (keep PII out of DB; PDF lives in private storage).
alter table public.dispute_letters
  add column if not exists draft_id uuid references public.letter_drafts (id) on delete set null;

alter table public.dispute_letters
  add column if not exists filename text;

alter table public.dispute_letters
  add column if not exists mime_type text;

alter table public.dispute_letters
  add column if not exists size_bytes bigint;

create index if not exists dispute_letters_draft_idx
  on public.dispute_letters (draft_id);
