-- 0025_quinb_followups.sql — QuinB Community › Follow-ups (Giulia, 27 Oct
-- 2026): who to write to, what was written, and who answered. Safe to re-run.
--
--   quinb_members          gains what "Refresh from QuinB" reads from Mighty,
--                          plus "Leave out of follow-ups" and "Paused until".
--   quinb_followups        one row per follow-up she wrote.
--   quinb_refresh_runs     one row per "Refresh from QuinB".
--   mighty_connection      the private-message connection: secrets. Row level
--                          security with no policy for anon, no *_api view;
--                          only the server reads it, with the service role.
-- Nothing is renamed or dropped; quinb_members_api keeps every column it had.

-- ------------------------------------------------------------- members
alter table quinb_members add column if not exists mighty_id         text;
alter table quinb_members add column if not exists mighty_gid        text;
alter table quinb_members add column if not exists first_name        text;
alter table quinb_members add column if not exists role              text;
alter table quinb_members add column if not exists member_type       text;
alter table quinb_members add column if not exists membership_status text;
alter table quinb_members add column if not exists plans             text[];
alter table quinb_members add column if not exists bio               text;
alter table quinb_members add column if not exists avatar_url        text;
alter table quinb_members add column if not exists profile_url       text;
alter table quinb_members add column if not exists last_active_at    timestamptz;
alter table quinb_members add column if not exists seen_at           timestamptz;
alter table quinb_members add column if not exists left_quinb_at     timestamptz;
alter table quinb_members add column if not exists followup_off      boolean not null default false;
alter table quinb_members add column if not exists paused_until      date;
alter table quinb_members add column if not exists last_dm_from_member_at timestamptz;
alter table quinb_members add column if not exists last_dm_from_me_at     timestamptz;
alter table quinb_members add column if not exists dm_conversation_id  text;
alter table quinb_members add column if not exists dm_conversation_url text;

create unique index if not exists quinb_members_mighty_id on quinb_members (mighty_id) where mighty_id is not null;

-- ------------------------------------------------------------ follow-ups
create table if not exists quinb_followups (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references quinb_members(id) on delete cascade,
  written_at       timestamptz not null default now(),
  via              text not null check (via in ('sent','by_hand')),
  message          text,
  note             text,
  conversation_id  text,
  conversation_url text,
  answered_at      timestamptz,
  answered_how     text check (answered_how in ('chat','by_hand')),
  answer_start     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists quinb_followups_member on quinb_followups (member_id, written_at desc);

create table if not exists quinb_refresh_runs (
  id        uuid primary key default gen_random_uuid(),
  ran_at    timestamptz not null default now(),
  read      int not null default 0,
  added     int not null default 0,
  updated   int not null default 0,
  gone      int not null default 0,
  error     text,
  notes     jsonb not null default '[]'::jsonb
);

-- ------------------------------------------------- private-message connection
create table if not exists mighty_connection (
  id                 text primary key,
  access_token       text,
  refresh_token      text,
  expires_at         timestamptz,
  scope              text,
  member_gid         text,
  member_name        text,
  connected_at       timestamptz,
  refreshed_at       timestamptz,
  refreshing_until   timestamptz,
  last_error         text,
  updated_at         timestamptz not null default now()
);

-- Row level security: the follow-up tables like the rest of the app (anon may
-- read and write); the connection with no policy for anon at all.
do $$
declare t text;
begin
  foreach t in array array['quinb_followups','quinb_refresh_runs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_anon', t);
    execute format('create policy %I on %I for all to anon using (true) with check (true)', t || '_anon', t);
  end loop;
end $$;
alter table mighty_connection enable row level security;
drop policy if exists mighty_connection_anon on mighty_connection;
revoke all on mighty_connection from anon;

-- Views, camelCase for the app. quinb_members_api keeps its columns first.
drop view if exists quinb_members_api;
create view quinb_members_api with (security_invoker = true) as
select id, name, email, member_since as "memberSince", last_login as "lastLogin", interactions, notes,
       updated_at as "updatedAt",
       mighty_id as "mightyId", mighty_gid as "mightyGid", first_name as "firstName", role,
       member_type as "memberType", membership_status as "membershipStatus", plans, bio,
       avatar_url as "avatarUrl", profile_url as "profileUrl", last_active_at as "lastActiveAt",
       seen_at as "seenAt", left_quinb_at as "leftQuinbAt", followup_off as "followupOff",
       paused_until as "pausedUntil", last_dm_from_member_at as "lastDmFromMemberAt",
       last_dm_from_me_at as "lastDmFromMeAt", dm_conversation_id as "dmConversationId",
       dm_conversation_url as "dmConversationUrl"
from quinb_members;

drop view if exists quinb_followups_api;
create view quinb_followups_api with (security_invoker = true) as
select id, member_id as "memberId", written_at as "writtenAt", via, message, note,
       conversation_id as "conversationId", conversation_url as "conversationUrl",
       answered_at as "answeredAt", answered_how as "answeredHow", answer_start as "answerStart"
from quinb_followups;

drop view if exists quinb_refresh_runs_api;
create view quinb_refresh_runs_api with (security_invoker = true) as
select id, ran_at as "ranAt", read, added, updated, gone, error, notes from quinb_refresh_runs;

grant select on quinb_members_api, quinb_followups_api, quinb_refresh_runs_api to anon;
