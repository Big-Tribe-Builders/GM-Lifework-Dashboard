-- 0023_quinb_plan_covers.sql — QuinB Community › Content strategy (Giulia,
-- 17 Oct 2026): years and months are cards in a gallery, like a Notion
-- gallery. Each card has a designed cover; she can put her own picture on
-- it instead. Without a picture the designed cover shows. Safe to re-run.

alter table quinb_years  add column if not exists cover_url text;
alter table quinb_months add column if not exists cover_url text;

drop view if exists quinb_years_api;
create view quinb_years_api with (security_invoker = true) as
select year, theme, audience, focus, goal, notes, cover_url as "coverUrl", updated_at as "updatedAt" from quinb_years;

drop view if exists quinb_months_api;
create view quinb_months_api with (security_invoker = true) as
select month, theme, focus, goal, note, notebooklm_url as "notebooklmUrl", cover_url as "coverUrl", updated_at as "updatedAt" from quinb_months;

grant select on quinb_years_api, quinb_months_api to anon;
