begin;

alter table public.market_metric_observation_revisions
  add column if not exists previous_record jsonb not null default '{}'::jsonb,
  add column if not exists replacement_record jsonb not null default '{}'::jsonb;

alter table public.market_metric_observation_revisions
  alter column previous_record drop default,
  alter column replacement_record drop default;

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

commit;
