-- 0018_nav_hiding.sql — from Settings › Spaces: hide a space from the rail,
-- hide a tab from a space's tab strip, and rename a tab. Nothing is deleted:
-- a hidden space or tab comes back the moment it is shown again, and a tab
-- with no name of hers keeps the name it has in the code.
-- Safe to re-run: the columns are added only if missing; the view is rebuilt.

alter table domain_settings add column if not exists hidden boolean not null default false;
alter table domain_settings add column if not exists hidden_tabs text[] not null default '{}';
alter table domain_settings add column if not exists tab_names jsonb not null default '{}'::jsonb;

drop view if exists domain_settings_api;
create view domain_settings_api with (security_invoker = true) as
  select slug, name, icon, accent,
         group_name as "groupName", sort_order as "sortOrder",
         hidden, hidden_tabs as "hiddenTabs", tab_names as "tabNames"
  from domain_settings;

grant select on domain_settings_api to anon, authenticated;
