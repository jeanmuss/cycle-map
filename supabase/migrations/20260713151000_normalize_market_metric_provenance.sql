begin;

update public.market_metric_observations
set fetched_at = coalesce(fetched_at, created_at),
    last_checked_at = coalesce(last_checked_at, fetched_at, created_at)
where fetched_at is null or last_checked_at is null;

update public.market_metric_observations
set source = case
  when source_url like 'https://www.sec.gov/%' then 'SEC EDGAR'
  when source_url like 'https://www.strategy.com/%' then 'Strategy official Form 8-K'
  else source
end
where metric_id like 'treasury.%'
  and (
    source_url like 'https://www.sec.gov/%'
    or source_url like 'https://www.strategy.com/%'
  );

commit;
