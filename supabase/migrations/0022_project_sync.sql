-- 0022_project_sync.sql — Vibe Coding › Refresh (Giulia, 13 Oct 2026): the
-- project list follows her Claude Code sessions. A routine in Claude Code
-- reads her session list and hands it to sync_code_projects(); the Refresh
-- button in Vibe Coding starts that routine.
--
--   project_groups        the code a session title starts with (LH, GA …) and
--                         the group it stands for. Filled from the chat, not
--                         from this file: the names are hers.
--   sync_code_projects()  a session whose title starts with a group code
--                         becomes a project, in Idea phase. One that is here
--                         already is brought up to date: its title, group,
--                         repository, branch, session state and last activity.
--                         It never touches what is hers (stage, Working on,
--                         priority, host, live address) and never removes a
--                         project: archiving a session in Claude Code archives
--                         nothing here.
--   code_projects_sync    when it last ran and what it did, for the page.
-- Safe to re-run.

create table if not exists project_groups (
  code text primary key,
  name text not null
);
-- Read only by the function; no policy, so the page's key cannot see it.
alter table project_groups enable row level security;

create table if not exists code_projects_sync (
  id        boolean primary key default true check (id),
  synced_at timestamptz not null,
  seen      integer not null,
  added     integer not null,
  updated   integer not null
);
alter table code_projects_sync enable row level security;
drop policy if exists code_projects_sync_read on code_projects_sync;
create policy code_projects_sync_read on code_projects_sync for select to anon, authenticated using (true);
grant select on code_projects_sync to anon, authenticated;

drop view if exists code_projects_sync_api;
create view code_projects_sync_api with (security_invoker = true) as
  select synced_at as "syncedAt", seen, added, updated from code_projects_sync;
grant select on code_projects_sync_api to anon, authenticated;

-- sessions: a JSON array, one object per session:
--   { "id", "title", "state", "updatedAt", "repoUrl", "repo", "branch" }
-- A field that is missing or null leaves what is here as it is.
create or replace function sync_code_projects(sessions jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  s jsonb;
  t text;
  g text;
  fresh boolean;
  n_seen int := 0;
  n_added int := 0;
  n_updated int := 0;
begin
  for s in select value from jsonb_array_elements(sessions) loop
    t := s->>'title';
    if s->>'id' is null or t is null then continue; end if;

    -- The group: the code the title starts with, followed by a space, a
    -- hyphen or nothing ("LH - Analytics", "PPN Website"); the longest wins.
    select pg.name into g
      from project_groups pg
     where left(t, length(pg.code)) = pg.code
       and (length(t) = length(pg.code) or substr(t, length(pg.code) + 1, 1) in (' ', '-'))
     order by length(pg.code) desc
     limit 1;
    if g is null then continue; end if;
    n_seen := n_seen + 1;

    insert into code_projects as c
      (session_id, name, client, repo_url, repo, branch, session_state, updated_at, status)
    values
      (s->>'id', t, g, s->>'repoUrl', s->>'repo', s->>'branch', s->>'state',
       nullif(s->>'updatedAt', '')::timestamptz, 'idea')
    on conflict (session_id) do update set
      name          = excluded.name,
      client        = excluded.client,
      repo_url      = coalesce(excluded.repo_url, c.repo_url),
      repo          = coalesce(excluded.repo, c.repo),
      branch        = coalesce(excluded.branch, c.branch),
      session_state = coalesce(excluded.session_state, c.session_state),
      updated_at    = coalesce(excluded.updated_at, c.updated_at)
    where (c.name, c.client, c.repo_url, c.repo, c.branch, c.session_state, c.updated_at)
          is distinct from
          (excluded.name, excluded.client,
           coalesce(excluded.repo_url, c.repo_url), coalesce(excluded.repo, c.repo),
           coalesce(excluded.branch, c.branch), coalesce(excluded.session_state, c.session_state),
           coalesce(excluded.updated_at, c.updated_at))
    returning (xmax = 0) into fresh;

    -- No row back: it was here already and nothing had changed.
    if found then
      if fresh then n_added := n_added + 1; else n_updated := n_updated + 1; end if;
    end if;
  end loop;

  insert into code_projects_sync (id, synced_at, seen, added, updated)
  values (true, now(), n_seen, n_added, n_updated)
  on conflict (id) do update set
    synced_at = excluded.synced_at, seen = excluded.seen,
    added = excluded.added, updated = excluded.updated;

  return jsonb_build_object('seen', n_seen, 'added', n_added, 'updated', n_updated);
end;
$$;

-- Only the routine runs it, through her Supabase connector; never the page's key.
revoke all on function sync_code_projects(jsonb) from public, anon, authenticated;
