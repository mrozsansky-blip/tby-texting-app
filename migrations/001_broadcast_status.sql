CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id text PRIMARY KEY,
  name text,
  body text,
  status text,
  created_at text,
  updated_at text
);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id text PRIMARY KEY,
  campaign_id text NOT NULL,
  family_name text,
  to_phone text,
  body text,
  status text,
  provider_message_id text,
  provider_status text,
  error_message text,
  raw_provider_error text,
  last_attempt_at text,
  created_at text,
  updated_at text
);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign_id ON broadcast_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign_status ON broadcast_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_provider_message_id ON broadcast_recipients(provider_message_id);
