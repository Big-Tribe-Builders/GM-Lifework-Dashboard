-- 0024_mail_sender_photo.sql — Mailing (Giulia, 27 Oct 2026): the QuinB email
-- template signs off with the sender's photo and name. The photo lives on the
-- sender, so every mail from that sender carries the same one. Safe to re-run.

alter table mail_senders add column if not exists photo_url text;

drop view if exists mail_senders_api;
create view mail_senders_api with (security_invoker = true) as
select id, venture, from_name as "fromName", from_email as "fromEmail", reply_to as "replyTo", address, photo_url as "photoUrl" from mail_senders;

grant select on mail_senders_api to anon;
