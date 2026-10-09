-- 0015_quinb_content.sql — QuinB Community: the content strategy (one page)
-- and the posts we pre-create, with a banner image per post. Safe to re-run.

create table if not exists quinb_strategy (
  id         text primary key,
  body       text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists quinb_posts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null default '',
  banner_url  text,
  space       text,
  planned_for date,
  status      text not null default 'idea' check (status in ('idea','draft','ready','posted')),
  posted_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['quinb_strategy','quinb_posts'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_anon', t);
    execute format('create policy %I on %I for all to anon using (true) with check (true)', t || '_anon', t);
  end loop;
end $$;

drop view if exists quinb_strategy_api;
create view quinb_strategy_api with (security_invoker = true) as
select id, body, updated_at as "updatedAt" from quinb_strategy;

drop view if exists quinb_posts_api;
create view quinb_posts_api with (security_invoker = true) as
select id, title, body, banner_url as "bannerUrl", space, planned_for as "plannedFor", status,
       posted_url as "postedUrl", updated_at as "updatedAt"
from quinb_posts;

grant select on quinb_strategy_api, quinb_posts_api to anon;

-- Banners: a public bucket the app uploads into. Images only, 5 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quinb-banners', 'quinb-banners', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists quinb_banners_read on storage.objects;
drop policy if exists quinb_banners_write on storage.objects;
drop policy if exists quinb_banners_change on storage.objects;
drop policy if exists quinb_banners_remove on storage.objects;
create policy quinb_banners_read   on storage.objects for select to anon using (bucket_id = 'quinb-banners');
create policy quinb_banners_write  on storage.objects for insert to anon with check (bucket_id = 'quinb-banners');
create policy quinb_banners_change on storage.objects for update to anon using (bucket_id = 'quinb-banners') with check (bucket_id = 'quinb-banners');
create policy quinb_banners_remove on storage.objects for delete to anon using (bucket_id = 'quinb-banners');
