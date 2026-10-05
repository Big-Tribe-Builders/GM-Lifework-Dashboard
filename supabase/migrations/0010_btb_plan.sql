-- 0010_btb_plan.sql — Big Tribe Builders' roadmap, experiments and playbook.
-- Safe to re-run: tables are created only if missing; views are rebuilt.

create table if not exists btb_plan (
  id         uuid primary key default gen_random_uuid(),
  quarter    text not null,
  track      text,
  title      text not null,
  owner      text,
  status     text not null default 'todo' check (status in ('todo','doing','done','parked')),
  start_date date,
  end_date   date,
  progress   int  not null default 0 check (progress between 0 and 100),
  notes      text,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists btb_experiments (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  hypothesis text,
  channel    text,
  owner      text,
  status     text not null default 'idea' check (status in ('idea','running','done','dropped')),
  start_date date,
  end_date   date,
  result     text,
  learning   text,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists btb_playbook (
  id         uuid primary key default gen_random_uuid(),
  framework  text not null,
  step       text not null,
  question   text not null,
  answer     text,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table btb_plan        enable row level security;
alter table btb_experiments enable row level security;
alter table btb_playbook    enable row level security;

drop policy if exists btb_plan_anon        on btb_plan;
drop policy if exists btb_experiments_anon on btb_experiments;
drop policy if exists btb_playbook_anon    on btb_playbook;
create policy btb_plan_anon        on btb_plan        for all to anon using (true) with check (true);
create policy btb_experiments_anon on btb_experiments for all to anon using (true) with check (true);
create policy btb_playbook_anon    on btb_playbook    for all to anon using (true) with check (true);

drop view if exists btb_plan_api;
create view btb_plan_api with (security_invoker = true) as
select id, quarter, track, title, owner, status,
       start_date as "startDate", end_date as "endDate", progress, notes, sort_order as "sortOrder"
from btb_plan;

drop view if exists btb_experiments_api;
create view btb_experiments_api with (security_invoker = true) as
select id, title, hypothesis, channel, owner, status,
       start_date as "startDate", end_date as "endDate", result, learning, sort_order as "sortOrder"
from btb_experiments;

drop view if exists btb_playbook_api;
create view btb_playbook_api with (security_invoker = true) as
select id, framework, step, question, answer, sort_order as "sortOrder"
from btb_playbook;

grant select on btb_plan_api, btb_experiments_api, btb_playbook_api to anon;
