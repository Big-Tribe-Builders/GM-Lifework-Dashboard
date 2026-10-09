-- 0014_book_and_members.sql — the Big Tribe Builders book (about + chapters)
-- and the QuinB Academy member list. Safe to re-run.

-- One row describes the book. The id is fixed so the About tab always
-- edits the same row; it is created on the first save, not here.
create table if not exists book (
  id          text primary key,
  title       text not null default '',
  description text not null default '',
  style       text not null default '',
  updated_at  timestamptz not null default now()
);

create table if not exists book_chapters (
  id         uuid primary key default gen_random_uuid(),
  number     int  not null default 1,
  title      text not null,
  summary    text,
  body       text not null default '',
  status     text not null default 'todo' check (status in ('todo','drafting','review','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- QuinB Academy members. Empty until Mighty Networks can be read; the
-- columns are the ones she named, plus name, email and notes.
create table if not exists quinb_members (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text,
  member_since date,
  last_login   date,
  interactions int,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['book','book_chapters','quinb_members'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_anon', t);
    execute format('create policy %I on %I for all to anon using (true) with check (true)', t || '_anon', t);
  end loop;
end $$;

drop view if exists book_api;
create view book_api with (security_invoker = true) as
select id, title, description, style, updated_at as "updatedAt" from book;

drop view if exists book_chapters_api;
create view book_chapters_api with (security_invoker = true) as
select id, number, title, summary, body, status, updated_at as "updatedAt" from book_chapters;

drop view if exists quinb_members_api;
create view quinb_members_api with (security_invoker = true) as
select id, name, email, member_since as "memberSince", last_login as "lastLogin", interactions, notes,
       updated_at as "updatedAt"
from quinb_members;

grant select on book_api, book_chapters_api, quinb_members_api to anon;

-- The rail was regrouped in code (Ventures · Work · Marketing · Intelligence ·
-- Assets). A stored place from the old rail no longer means what it did, so
-- the stored places of the moved spaces and the collection order are cleared;
-- names, icons and colours she chose are kept. Safe to re-run.
update domain_settings
   set group_name = null, sort_order = null
 where slug in ('goal-navigator','clients','mailing','upwork','apps','content','book');
delete from domain_settings where slug in ('studying','fitness','accountancy');
delete from collection_settings;
