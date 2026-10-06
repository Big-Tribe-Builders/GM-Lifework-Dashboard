-- 0011_pulse.sql — Pulse lines she has ticked off, and updated_at on the roadmap view.
-- Safe to re-run.

create table if not exists pulse_dismissed (
  key          text primary key,
  dismissed_at timestamptz not null default now()
);
alter table pulse_dismissed enable row level security;
drop policy if exists pulse_dismissed_anon on pulse_dismissed;
create policy pulse_dismissed_anon on pulse_dismissed for all to anon using (true) with check (true);

drop view if exists pulse_dismissed_api;
create view pulse_dismissed_api with (security_invoker = true) as
select key from pulse_dismissed;
grant select on pulse_dismissed_api to anon;

-- the roadmap view now also says when a line last changed (for the "stalled" rule)
drop view if exists btb_plan_api;
create view btb_plan_api with (security_invoker = true) as
select id, quarter, track, title, owner, status,
       start_date as "startDate", end_date as "endDate", progress, notes, sort_order as "sortOrder",
       updated_at as "updatedAt"
from btb_plan;
grant select on btb_plan_api to anon;
