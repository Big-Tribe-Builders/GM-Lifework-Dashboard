-- 0012_goal_navigator.sql — the Goal Navigator: yearly goals, quarterly goals, action points.
-- Safe to re-run.

create table if not exists goal_years (
  id         uuid primary key default gen_random_uuid(),
  year       int  not null,
  venture    text not null,
  title      text not null,
  status     text not null default 'todo' check (status in ('todo','doing','done','parked')),
  notes      text,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists goal_quarters (
  id           uuid primary key default gen_random_uuid(),
  quarter      text not null,
  venture      text not null,
  year_goal_id uuid references goal_years(id) on delete set null,
  title        text not null,
  status       text not null default 'todo' check (status in ('todo','doing','done','parked')),
  notes        text,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists goal_actions (
  id              uuid primary key default gen_random_uuid(),
  quarter         text not null,
  venture         text not null,
  quarter_goal_id uuid references goal_quarters(id) on delete set null,
  title           text not null,
  owner           text,
  status          text not null default 'todo' check (status in ('todo','doing','done','parked')),
  do_date         date,
  due_date        date,
  priority        text check (priority in ('high','normal','low')),
  notes           text,
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table goal_years    enable row level security;
alter table goal_quarters enable row level security;
alter table goal_actions  enable row level security;
drop policy if exists goal_years_anon    on goal_years;
drop policy if exists goal_quarters_anon on goal_quarters;
drop policy if exists goal_actions_anon  on goal_actions;
create policy goal_years_anon    on goal_years    for all to anon using (true) with check (true);
create policy goal_quarters_anon on goal_quarters for all to anon using (true) with check (true);
create policy goal_actions_anon  on goal_actions  for all to anon using (true) with check (true);

drop view if exists goal_years_api;
create view goal_years_api with (security_invoker = true) as
select id, year, venture, title, status, notes, sort_order as "sortOrder" from goal_years;

drop view if exists goal_quarters_api;
create view goal_quarters_api with (security_invoker = true) as
select id, quarter, venture, year_goal_id as "yearGoalId", title, status, notes, sort_order as "sortOrder" from goal_quarters;

drop view if exists goal_actions_api;
create view goal_actions_api with (security_invoker = true) as
select id, quarter, venture, quarter_goal_id as "quarterGoalId", title, owner, status,
       do_date as "doDate", due_date as "dueDate", priority, notes, sort_order as "sortOrder", updated_at as "updatedAt"
from goal_actions;

grant select on goal_years_api, goal_quarters_api, goal_actions_api to anon;
