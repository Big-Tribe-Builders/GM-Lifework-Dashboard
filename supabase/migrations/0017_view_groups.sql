-- 0017_view_groups.sql — the colour she gives a group: a list in a gallery,
-- a fold in a table. One row per collection and group (for example
-- 'goal-navigator/years' and '2026'); no row means no colour.
-- Safe to re-run: the table is created only if missing; the view is rebuilt.

create table if not exists view_groups (
  grid       text not null,
  group_key  text not null,
  color      text not null,
  updated_at timestamptz not null default now(),
  primary key (grid, group_key)
);

alter table view_groups enable row level security;

drop policy if exists view_groups_anon on view_groups;
create policy view_groups_anon on view_groups
  for all to anon using (true) with check (true);

drop view if exists view_groups_api;
create view view_groups_api
with (security_invoker = true) as
select grid, group_key as "groupKey", color
from view_groups;

grant select on view_groups_api to anon;
