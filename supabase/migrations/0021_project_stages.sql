-- 0021_project_stages.sql — Vibe Coding: her stages for a project (Giulia,
-- 13 Oct 2026), in this order: Idea phase, Next up, Building, Review,
-- Running, Paused, Closed, Archived. Running takes the place of Live: every
-- project marked Live becomes Running. The names she reads live in the app
-- (src/lib/projects.ts); the table keeps short keys.
-- Safe to re-run: the check is dropped and added again, and the update only
-- touches a row that still says Live.

alter table code_projects drop constraint if exists code_projects_status_check;

update code_projects set status = 'running' where status = 'live';

alter table code_projects add constraint code_projects_status_check
  check (status in ('idea', 'next_up', 'building', 'review', 'running', 'paused', 'closed', 'archived'));
