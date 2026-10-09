-- 0016_quinb_plan.sql — QuinB Community content plan, after her Notion
-- (QuinB_CP_Year, QuinB_CP_Montly_Themes, Weekly Content Schedule,
-- QuinB_CP_Content): years → months → weeks → a post per day, each day
-- with its daily post type. Safe to re-run.

-- A year: her Notion fields.
create table if not exists quinb_years (
  year       int primary key,
  theme      text,
  audience   text check (audience in ('External','Community')),
  focus      text,
  goal       text,
  notes      text,
  updated_at timestamptz not null default now()
);

-- A month, keyed '2027-01'.
create table if not exists quinb_months (
  month           text primary key check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  theme           text,
  focus           text,
  goal            text,
  note            text,
  notebooklm_url  text,
  updated_at      timestamptz not null default now()
);

-- A week, keyed by its Monday. Theme = Notion's "Week 1..5" line;
-- plan = what we do that week, in her words.
create table if not exists quinb_weeks (
  monday     date primary key check (extract(isodow from monday) = 1),
  theme      text,
  plan       text,
  updated_at timestamptz not null default now()
);

-- The daily post types (Weekly Content Schedule): one per weekday,
-- 1 = Monday … 7 = Sunday.
create table if not exists quinb_post_types (
  id          uuid primary key default gen_random_uuid(),
  weekday     int  not null unique check (weekday between 1 and 7),
  title       text not null,
  kind        text check (kind in ('Article','Question','Quick Post')),
  hour        text,
  space       text,
  posted_by   text,
  banner_url  text,
  purpose     text not null default '',
  prompt      text not null default '',
  example     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Posts: the daily post type they follow, and the Progress steps from
-- her Notion plus Approved and Posted.
alter table quinb_posts add column if not exists post_type_id uuid references quinb_post_types(id) on delete set null;
alter table quinb_posts drop constraint if exists quinb_posts_status_check;
update quinb_posts set status = case status when 'draft' then 'in_progress' when 'ready' then 'approved' else status end
 where status in ('draft','ready');
alter table quinb_posts alter column status set default 'idea';
alter table quinb_posts add constraint quinb_posts_status_check
  check (status in ('idea','planned','next_up','in_progress','review','approved','scheduled','posted','hold','cancelled'));

do $$
declare t text;
begin
  foreach t in array array['quinb_years','quinb_months','quinb_weeks','quinb_post_types'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_anon', t);
    execute format('create policy %I on %I for all to anon using (true) with check (true)', t || '_anon', t);
  end loop;
end $$;

drop view if exists quinb_years_api;
create view quinb_years_api with (security_invoker = true) as
select year, theme, audience, focus, goal, notes, updated_at as "updatedAt" from quinb_years;

drop view if exists quinb_months_api;
create view quinb_months_api with (security_invoker = true) as
select month, theme, focus, goal, note, notebooklm_url as "notebooklmUrl", updated_at as "updatedAt" from quinb_months;

drop view if exists quinb_weeks_api;
create view quinb_weeks_api with (security_invoker = true) as
select to_char(monday, 'YYYY-MM-DD') as monday, theme, plan, updated_at as "updatedAt" from quinb_weeks;

drop view if exists quinb_post_types_api;
create view quinb_post_types_api with (security_invoker = true) as
select id, weekday, title, kind, hour, space, posted_by as "postedBy", banner_url as "bannerUrl",
       purpose, prompt, example, updated_at as "updatedAt"
from quinb_post_types;

drop view if exists quinb_posts_api;
create view quinb_posts_api with (security_invoker = true) as
select id, title, body, banner_url as "bannerUrl", space, planned_for as "plannedFor", status,
       posted_url as "postedUrl", post_type_id as "postTypeId", updated_at as "updatedAt"
from quinb_posts;

grant select on quinb_years_api, quinb_months_api, quinb_weeks_api, quinb_post_types_api, quinb_posts_api to anon;

-- The one-page strategy from 0015 is replaced by the plan. It goes only
-- if nothing was written in it; otherwise it stays and nothing is lost.
-- (Nested on purpose: the inner query is only parsed once the table exists.)
do $$
begin
  if to_regclass('public.quinb_strategy') is not null then
    if not exists (select 1 from quinb_strategy where coalesce(trim(body), '') <> '') then
      drop view if exists quinb_strategy_api;
      drop table quinb_strategy;
    end if;
  end if;
end $$;
