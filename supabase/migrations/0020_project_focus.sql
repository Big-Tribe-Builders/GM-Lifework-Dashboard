-- 0020_project_focus.sql — Vibe Coding › Building: what she is working on
-- now, and the order of priority (1 first). Both are hers to set from the
-- grid, like the status in 0009, and travel through the same small view.
-- Safe to re-run: the columns are added only if missing; the view is rebuilt.

alter table code_projects add column if not exists working_on boolean not null default false;
alter table code_projects add column if not exists priority integer;

drop view if exists code_projects_status_api;
create view code_projects_status_api with (security_invoker = true) as
  select session_id as "sessionId", status, working_on as "workingOn", priority
  from code_projects;

grant select on code_projects_status_api to anon, authenticated;

-- The page may change these three and nothing else; the WHERE needs the key.
grant select (session_id), update (status, working_on, priority) on code_projects to anon, authenticated;
