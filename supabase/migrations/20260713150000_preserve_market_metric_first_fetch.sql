begin;

alter table public.market_metric_observations
  add column if not exists last_checked_at timestamptz;

update public.market_metric_observations
set last_checked_at = coalesce(last_checked_at, fetched_at, updated_at)
where last_checked_at is null;

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

commit;
