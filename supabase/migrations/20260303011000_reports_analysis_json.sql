-- Store the full UI-ready analysis JSON directly on reports.

alter table public.reports
  add column if not exists analysis_json jsonb;

create index if not exists reports_analysis_json_gin
  on public.reports using gin (analysis_json);
