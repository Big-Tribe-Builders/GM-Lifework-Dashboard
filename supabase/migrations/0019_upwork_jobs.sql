-- 0019_upwork_jobs.sql — Upwork › Proposals: the job pipeline. One row per
-- job found on Upwork, with why it fits, where it stands, and the proposal
-- written for it. The fields and statuses follow her Notion database
-- "Upwork Pipeline", so moving the work over changes nothing in how it reads.
-- Safe to re-run: the table is created only if missing; the view is rebuilt.

create table if not exists upwork_jobs (
  id                uuid primary key default gen_random_uuid(),
  job_id            text unique,            -- Upwork's id for the job, when known
  title             text not null,
  url               text,
  description       text,
  client            text,
  country           text,
  client_rating     numeric(3,2),
  client_spend      text,
  payment_verified  boolean,
  budget            text,
  proposals_at_scan text,
  posted_on         date,
  found_on          date not null default current_date,
  platform          text check (platform in ('Mighty Networks','Circle','Skool','Other')),
  work_type         text[] not null default '{}',
  fit               text check (fit in ('strong','possible','skip')),
  why_it_fits       text,
  status            text not null default 'open' check (status in (
                      'open','proposal_draft','approved','posted','read_by_client',
                      'free_consultation','accepted','declined','moved_to_client_projects','skipped')),
  proposal          text not null default '',
  next_action       text,
  next_action_date  date,
  connects_spent    integer,
  sent_on           date,
  last_activity     date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists upwork_jobs_status on upwork_jobs (status);
create index if not exists upwork_jobs_found on upwork_jobs (found_on desc);

alter table upwork_jobs enable row level security;
drop policy if exists upwork_jobs_anon on upwork_jobs;
create policy upwork_jobs_anon on upwork_jobs for all to anon using (true) with check (true);

drop view if exists upwork_jobs_api;
create view upwork_jobs_api with (security_invoker = true) as
select id, job_id as "jobId", title, url, description, client, country,
       client_rating as "clientRating", client_spend as "clientSpend", payment_verified as "paymentVerified",
       budget, proposals_at_scan as "proposalsAtScan", posted_on as "postedOn", found_on as "foundOn",
       platform, work_type as "workType", fit, why_it_fits as "whyItFits", status, proposal,
       next_action as "nextAction", next_action_date as "nextActionDate", connects_spent as "connectsSpent",
       sent_on as "sentOn", last_activity as "lastActivity", notes, updated_at as "updatedAt"
from upwork_jobs;

grant select on upwork_jobs_api to anon, authenticated;
