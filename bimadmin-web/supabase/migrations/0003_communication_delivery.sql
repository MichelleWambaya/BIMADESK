-- Adds real send tracking on top of 0001_init.sql and 0002_team_invites.sql.

alter table communications
  add column delivery_status text not null default 'simulated'
    check (delivery_status in ('simulated', 'queued', 'sent', 'failed')),
  add column provider_message_id text,
  add column error_message text;

-- A cheap per-organization rate limit for real sends, checked by the
-- send-email / send-sms / send-whatsapp functions before they call out
-- to a provider. Without this, any signed-in member of an organization
-- could turn the send functions into a spam relay against arbitrary
-- recipients, since the app has no way to verify a "to" address is
-- actually one of that organization's own clients.
create index if not exists communications_org_occurred_idx on communications (organization_id, occurred_at);
