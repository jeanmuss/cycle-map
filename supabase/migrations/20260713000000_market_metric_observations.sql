begin;

create table if not exists public.market_metric_observations (
  id bigint generated always as identity primary key,
  metric_id text not null,
  observed_at timestamptz not null,
  value numeric not null,
  unit text not null,
  cadence text not null,
  source text not null,
  source_url text,
  source_key text not null,
  quality_status text not null default 'available',
  fetched_at timestamptz,
  last_checked_at timestamptz,
  transformed_at timestamptz,
  dimensions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_metric_observations_metric_id_not_blank check (btrim(metric_id) <> ''),
  constraint market_metric_observations_unit_not_blank check (btrim(unit) <> ''),
  constraint market_metric_observations_source_key_not_blank check (btrim(source_key) <> ''),
  constraint market_metric_observations_dimensions_object check (jsonb_typeof(dimensions) = 'object'),
  constraint market_metric_observations_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint market_metric_observations_unique_fact unique (metric_id, observed_at, source_key)
);

create index if not exists market_metric_observations_metric_time_idx
  on public.market_metric_observations (metric_id, observed_at desc);

create table if not exists public.market_metric_observation_revisions (
  id bigint generated always as identity primary key,
  observation_id bigint not null references public.market_metric_observations(id),
  previous_value numeric not null,
  replacement_value numeric not null,
  previous_quality_status text not null,
  replacement_quality_status text not null,
  previous_metadata jsonb not null,
  replacement_metadata jsonb not null,
  previous_record jsonb not null,
  replacement_record jsonb not null,
  changed_at timestamptz not null default now()
);

create index if not exists market_metric_observation_revisions_observation_idx
  on public.market_metric_observation_revisions (observation_id, changed_at desc);

alter table public.market_metric_observations enable row level security;
alter table public.market_metric_observation_revisions enable row level security;

revoke all on table public.market_metric_observations from anon, authenticated;
revoke all on table public.market_metric_observation_revisions from anon, authenticated;
grant select, insert, update on table public.market_metric_observations to service_role;
grant select, insert on table public.market_metric_observation_revisions to service_role;
grant usage, select on sequence public.market_metric_observations_id_seq to service_role;
grant usage, select on sequence public.market_metric_observation_revisions_id_seq to service_role;

drop policy if exists market_metric_observations_no_public_access on public.market_metric_observations;
create policy market_metric_observations_no_public_access
  on public.market_metric_observations
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists market_metric_observation_revisions_no_public_access on public.market_metric_observation_revisions;
create policy market_metric_observation_revisions_no_public_access
  on public.market_metric_observation_revisions
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.set_market_metric_observation_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.fetched_at = coalesce(old.fetched_at, new.fetched_at);
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.log_market_metric_observation_revision()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.value is distinct from new.value
    or old.unit is distinct from new.unit
    or old.cadence is distinct from new.cadence
    or old.source is distinct from new.source
    or old.source_url is distinct from new.source_url
    or old.quality_status is distinct from new.quality_status
    or old.dimensions is distinct from new.dimensions
    or old.metadata is distinct from new.metadata then
    insert into public.market_metric_observation_revisions (
      observation_id,
      previous_value,
      replacement_value,
      previous_quality_status,
      replacement_quality_status,
      previous_metadata,
      replacement_metadata,
      previous_record,
      replacement_record
    ) values (
      old.id,
      old.value,
      new.value,
      old.quality_status,
      new.quality_status,
      old.metadata,
      new.metadata,
      to_jsonb(old),
      to_jsonb(new)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists market_metric_observations_set_updated_at on public.market_metric_observations;
create trigger market_metric_observations_set_updated_at
  before update on public.market_metric_observations
  for each row
  execute function public.set_market_metric_observation_updated_at();

drop trigger if exists market_metric_observations_revision on public.market_metric_observations;
create trigger market_metric_observations_revision
  after update on public.market_metric_observations
  for each row
  execute function public.log_market_metric_observation_revision();

revoke all on function public.set_market_metric_observation_updated_at() from public, anon, authenticated;
revoke all on function public.log_market_metric_observation_revision() from public, anon, authenticated;
grant execute on function public.set_market_metric_observation_updated_at() to service_role;
grant execute on function public.log_market_metric_observation_revision() to service_role;

commit;
