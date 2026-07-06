begin;

create extension if not exists pgcrypto;

create table if not exists public.manual_macro_events (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  event_date date not null,
  series_id text not null,
  label text,
  label_zh text,
  label_en text,
  category text not null,
  role text not null,
  cadence text not null default 'event',
  unit text not null default 'event',
  source text not null,
  source_url text,
  date_meaning text,
  release_time_utc timestamptz,
  actual numeric,
  previous numeric,
  forecast numeric,
  change numeric,
  change_bp numeric,
  pct_change numeric,
  year_ago numeric,
  yoy_pct numeric,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manual_macro_events_unique_series_date unique (series_id, event_date)
);

create index if not exists manual_macro_events_status_date_idx
  on public.manual_macro_events (status, event_date);

create index if not exists manual_macro_events_category_date_idx
  on public.manual_macro_events (category, event_date);

create index if not exists manual_macro_events_release_time_idx
  on public.manual_macro_events (release_time_utc)
  where release_time_utc is not null;

create table if not exists public.manual_macro_event_audit (
  id bigint generated always as identity primary key,
  event_id uuid,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  row_data jsonb not null,
  changed_by text,
  changed_at timestamptz not null default now()
);

create index if not exists manual_macro_event_audit_event_id_idx
  on public.manual_macro_event_audit (event_id);

alter table public.manual_macro_events enable row level security;
alter table public.manual_macro_event_audit enable row level security;

drop policy if exists manual_macro_events_no_public_access on public.manual_macro_events;
create policy manual_macro_events_no_public_access
  on public.manual_macro_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists manual_macro_event_audit_no_public_access on public.manual_macro_event_audit;
create policy manual_macro_event_audit_no_public_access
  on public.manual_macro_event_audit
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.set_manual_macro_events_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.log_manual_macro_event_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  row_payload jsonb;
  actor text;
  target_event_id uuid;
begin
  if tg_op = 'DELETE' then
    row_payload = to_jsonb(old);
    actor = coalesce(old.updated_by, old.created_by, current_user);
    target_event_id = old.id;
  else
    row_payload = to_jsonb(new);
    actor = coalesce(new.updated_by, new.created_by, current_user);
    target_event_id = new.id;
  end if;

  insert into public.manual_macro_event_audit (event_id, operation, row_data, changed_by)
  values (target_event_id, tg_op, row_payload, actor);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists manual_macro_events_set_updated_at on public.manual_macro_events;
create trigger manual_macro_events_set_updated_at
  before update on public.manual_macro_events
  for each row
  execute function public.set_manual_macro_events_updated_at();

drop trigger if exists manual_macro_events_audit on public.manual_macro_events;
create trigger manual_macro_events_audit
  after insert or update or delete on public.manual_macro_events
  for each row
  execute function public.log_manual_macro_event_change();

commit;
