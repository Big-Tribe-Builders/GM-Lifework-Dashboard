-- 0013_mailing.sql — Mailing: lists over the CRM emails, templates, senders,
-- campaigns (broadcasts and sequences), one row per email handed to Resend,
-- the suppression list, and the events Resend reports back.
-- Safe to re-run.

-- Lists: a label over addresses that already exist in crm_emails.
create table if not exists mail_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  venture     text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists mail_list_members (
  list_id  uuid not null references mail_lists(id) on delete cascade,
  email    text not null references crm_emails(email) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, email)
);

-- Templates: subject + body with placeholders; the style picks the look.
create table if not exists mail_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  venture    text not null,
  subject    text not null default '',
  preheader  text,
  body       text not null default '',
  style      text not null default 'plain' check (style in ('plain','quinb','btb')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Senders: the From identity per venture, and the postal address the footer
-- must carry.
create table if not exists mail_senders (
  id         uuid primary key default gen_random_uuid(),
  venture    text not null,
  from_name  text not null,
  from_email text not null,
  reply_to   text,
  address    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Campaigns: a broadcast (one email to a list) or a sequence (steps on a
-- schedule). send_at is when a broadcast goes, or when a sequence starts.
create table if not exists mail_campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  venture     text not null,
  kind        text not null default 'broadcast' check (kind in ('broadcast','sequence')),
  list_id     uuid references mail_lists(id) on delete set null,
  template_id uuid references mail_templates(id) on delete set null,
  sender_id   uuid references mail_senders(id) on delete set null,
  status      text not null default 'draft' check (status in ('draft','scheduled','sending','sent','paused')),
  send_at     timestamptz,
  quote       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists mail_sequence_steps (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references mail_campaigns(id) on delete cascade,
  step        int  not null default 1,
  day_offset  int  not null default 0,
  template_id uuid references mail_templates(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- One row per email to one person. personal_line is the sentence written
-- for that person. resend_id comes back from Resend; the webhook moves the
-- status from there.
create table if not exists mail_sends (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references mail_campaigns(id) on delete cascade,
  step_id           uuid references mail_sequence_steps(id) on delete cascade,
  email             text not null,
  personal_line     text,
  status            text not null default 'planned'
                    check (status in ('planned','queued','sent','delivered','opened','clicked','bounced','complained','failed','skipped')),
  resend_id         text,
  scheduled_for     timestamptz,
  sent_at           timestamptz,
  error             text,
  unsubscribe_token text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique nulls not distinct (campaign_id, step_id, email)
);
create index if not exists mail_sends_resend_id on mail_sends (resend_id);
create index if not exists mail_sends_token on mail_sends (unsubscribe_token);

-- Addresses we never send to again, and why.
create table if not exists mail_suppressions (
  email      text primary key,
  reason     text not null check (reason in ('unsubscribed','bounced','complained','manual')),
  note       text,
  created_at timestamptz not null default now()
);

-- What Resend told us, raw, so nothing is lost.
create table if not exists mail_events (
  id         bigserial primary key,
  resend_id  text,
  type       text not null,
  email      text,
  payload    jsonb,
  created_at timestamptz not null default now()
);

-- RLS, same shape as the rest of the dashboard.
do $$
declare t text;
begin
  foreach t in array array['mail_lists','mail_list_members','mail_templates','mail_senders','mail_campaigns','mail_sequence_steps','mail_sends','mail_suppressions','mail_events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_anon', t);
    execute format('create policy %I on %I for all to anon using (true) with check (true)', t || '_anon', t);
  end loop;
end $$;

-- Views, camelCase for the app.
drop view if exists mail_lists_api;
create view mail_lists_api with (security_invoker = true) as
select l.id, l.name, l.venture, l.description,
       (select count(*) from mail_list_members m where m.list_id = l.id)::int as "memberCount",
       l.created_at as "createdAt"
from mail_lists l;

drop view if exists mail_list_members_api;
create view mail_list_members_api with (security_invoker = true) as
select list_id as "listId", email, added_at as "addedAt" from mail_list_members;

drop view if exists mail_templates_api;
create view mail_templates_api with (security_invoker = true) as
select id, name, venture, subject, preheader, body, style, updated_at as "updatedAt" from mail_templates;

drop view if exists mail_senders_api;
create view mail_senders_api with (security_invoker = true) as
select id, venture, from_name as "fromName", from_email as "fromEmail", reply_to as "replyTo", address from mail_senders;

drop view if exists mail_campaigns_api;
create view mail_campaigns_api with (security_invoker = true) as
select id, name, venture, kind, list_id as "listId", template_id as "templateId", sender_id as "senderId",
       status, send_at as "sendAt", quote, notes, created_at as "createdAt", updated_at as "updatedAt"
from mail_campaigns;

drop view if exists mail_sequence_steps_api;
create view mail_sequence_steps_api with (security_invoker = true) as
select id, campaign_id as "campaignId", step, day_offset as "dayOffset", template_id as "templateId" from mail_sequence_steps;

drop view if exists mail_sends_api;
create view mail_sends_api with (security_invoker = true) as
select id, campaign_id as "campaignId", step_id as "stepId", email, personal_line as "personalLine", status,
       resend_id as "resendId", scheduled_for as "scheduledFor", sent_at as "sentAt", error
from mail_sends;

drop view if exists mail_suppressions_api;
create view mail_suppressions_api with (security_invoker = true) as
select email, reason, note, created_at as "createdAt" from mail_suppressions;

grant select on mail_lists_api, mail_list_members_api, mail_templates_api, mail_senders_api,
                mail_campaigns_api, mail_sequence_steps_api, mail_sends_api, mail_suppressions_api to anon;
