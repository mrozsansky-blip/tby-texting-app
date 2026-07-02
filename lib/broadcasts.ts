export type CampaignRecipientStatus = 'delivered' | 'failed' | 'failed_fetch' | 'textgrid_http_400' | 'undelivered' | 'queued' | 'pending' | 'sent' | 'ready_to_send' | 'not_attempted' | 'other';

export type BroadcastRecipientInput = {
  familyName?: string;
  personName?: string;
  phoneE164: string;
  body?: string;
};

export type BroadcastRecipient = {
  id: string;
  campaignId: string;
  familyName: string;
  to: string;
  body: string;
  status: string;
  normalizedStatus: CampaignRecipientStatus;
  providerMessageId: string;
  providerStatus: string;
  errorMessage: string;
  rawProviderError: string;
  lastAttemptAt: string;
  createdAt: string;
  updatedAt: string;
};

export type BroadcastCampaign = {
  id: string;
  name: string;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type CampaignAudit = {
  campaign: { id: string; name: string; body: string; status: string };
  counts: {
    totalRecipients: number;
    sent: number;
    delivered: number;
    queuedPending: number;
    failed: number;
    failedFetch: number;
    textgridHttp400Failures: number;
    undelivered: number;
    reachedTextgrid: number;
    notAttempted: number;
  };
  recipients: BroadcastRecipient[];
};

export const BROADCAST_STORAGE_NOT_CONFIGURED_MESSAGE = 'Broadcast status storage is not configured. Please set up Turso before sending live broadcasts.';

type SqlValue = string | number | null;
type HranaValue = { type: 'null' } | { type: 'text'; value: string } | { type: 'integer'; value: string } | { type: 'float'; value: string };
type ExecuteResult = { cols?: Array<{ name: string }>; rows?: HranaValue[][]; affected_row_count?: number };
type PipelineOkResult = { type: 'ok'; response: { type: 'execute'; result: ExecuteResult } | { type: 'close' } };
type PipelineErrorResult = { type: 'error'; error: { message?: string; code?: string } };
type PipelineResponse = { results?: Array<PipelineOkResult | PipelineErrorResult> };

type SqlStatement = { sql: string; args?: SqlValue[] };

let schemaReady: Promise<void> | null = null;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tursoConfig() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!databaseUrl || !authToken) throw new Error(BROADCAST_STORAGE_NOT_CONFIGURED_MESSAGE);
  const baseUrl = databaseUrl
    .replace(/^libsql:\/\//, 'https://')
    .replace(/\/$/, '')
    .replace(/\/v2\/pipeline$/, '');
  return { pipelineUrl: `${baseUrl}/v2/pipeline`, authToken };
}

function toHranaValue(value: SqlValue): HranaValue {
  if (value === null || value === undefined) return { type: 'null' };
  if (typeof value === 'number') return Number.isInteger(value) ? { type: 'integer', value: String(value) } : { type: 'float', value: String(value) };
  return { type: 'text', value };
}

function fromHranaValue(value: HranaValue | undefined) {
  if (!value || value.type === 'null') return '';
  return value.value;
}

async function executePipeline(statements: SqlStatement[]) {
  const { pipelineUrl, authToken } = tursoConfig();
  const response = await fetch(pipelineUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        ...statements.map((statement) => ({
          type: 'execute',
          stmt: {
            sql: statement.sql,
            ...(statement.args ? { args: statement.args.map(toHranaValue) } : {})
          }
        })),
        { type: 'close' }
      ]
    })
  });
  const payload = await response.json().catch(() => ({})) as PipelineResponse;
  if (!response.ok) throw new Error(`Turso broadcast storage request failed with HTTP ${response.status}.`);
  const results = payload.results || [];
  const failed = results.find((result): result is PipelineErrorResult => result.type === 'error');
  if (failed) throw new Error(failed.error.message || failed.error.code || 'Turso broadcast storage query failed.');
  return results
    .filter((result): result is PipelineOkResult => result.type === 'ok' && result.response.type === 'execute')
    .map((result) => result.response.type === 'execute' ? result.response.result : { rows: [], cols: [] });
}

async function ensureBroadcastSchema() {
  schemaReady ||= executePipeline([
    { sql: 'CREATE TABLE IF NOT EXISTS broadcast_campaigns (id text PRIMARY KEY, name text, body text, status text, created_at text, updated_at text)' },
    { sql: 'CREATE TABLE IF NOT EXISTS broadcast_recipients (id text PRIMARY KEY, campaign_id text NOT NULL, family_name text, to_phone text, body text, status text, provider_message_id text, provider_status text, error_message text, raw_provider_error text, last_attempt_at text, created_at text, updated_at text)' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign_id ON broadcast_recipients(campaign_id)' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign_status ON broadcast_recipients(campaign_id, status)' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_provider_message_id ON broadcast_recipients(provider_message_id)' }
  ]).then(() => undefined);
  return schemaReady;
}

async function query(statements: SqlStatement[]) {
  await ensureBroadcastSchema();
  return executePipeline(statements);
}

async function queryWithoutSchema(statements: SqlStatement[]) {
  return executePipeline(statements);
}

function rowObjects(result: ExecuteResult | undefined) {
  const columns = result?.cols?.map((column) => column.name) || [];
  return (result?.rows || []).map((row) => Object.fromEntries(columns.map((column, index) => [column, fromHranaValue(row[index])]))) as Array<Record<string, string>>;
}

export function normalizeCampaignRecipientStatus(status: string, errorMessage = '', providerStatus = ''): CampaignRecipientStatus {
  const providerText = normalizeText(providerStatus);
  const appText = normalizeText(status);
  const errorText = normalizeText(errorMessage);
  const combinedErrorText = normalizeText(`${providerStatus} ${errorMessage}`);

  if (providerText === 'delivered' || /\bdelivered\b/.test(providerText)) return 'delivered';
  if (/failed fetch/.test(combinedErrorText)) return 'failed_fetch';
  if (/http\s*400|\b400\b|bad request/.test(combinedErrorText)) return 'textgrid_http_400';
  if (/\bundelivered\b/.test(providerText)) return 'undelivered';
  if (/\b(failed|failure|error)\b/.test(providerText) || /\b(failed|failure|error)\b/.test(errorText)) return 'failed';
  if (/\b(queue|queued|pending|sending)\b/.test(providerText)) return providerText.includes('pending') ? 'pending' : 'queued';
  if (/\bsent\b|reached textgrid|reached provider/.test(providerText)) return 'sent';
  if (/\bsent\b/.test(appText)) return 'sent';
  if (/ready to send|ready_to_send/.test(appText)) return 'ready_to_send';
  if (!appText || /\b(draft|preview|not attempted|new)\b/.test(appText)) return 'not_attempted';
  if (/\b(queue|queued|pending|sending)\b/.test(appText)) return appText.includes('pending') ? 'pending' : 'queued';
  return 'other';
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function campaignFromRow(row: Record<string, string>): BroadcastCampaign {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function recipientFromRow(row: Record<string, string>): BroadcastRecipient {
  const status = row.status || '';
  const errorMessage = row.error_message || '';
  const providerStatus = row.provider_status || '';
  return {
    id: row.id,
    campaignId: row.campaign_id,
    familyName: row.family_name,
    to: row.to_phone,
    body: row.body,
    status,
    normalizedStatus: normalizeCampaignRecipientStatus(status, errorMessage, providerStatus),
    providerMessageId: row.provider_message_id,
    providerStatus,
    errorMessage,
    rawProviderError: row.raw_provider_error,
    lastAttemptAt: row.last_attempt_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createBroadcastCampaign(input: { name: string; body: string; status?: string; recipients: BroadcastRecipientInput[] }) {
  await ensureBroadcastSchema();
  const now = new Date().toISOString();
  const campaign: BroadcastCampaign = {
    id: createId('bc'),
    name: input.name,
    body: input.body,
    status: input.status || 'Ready to send',
    createdAt: now,
    updatedAt: now
  };
  const recipients: BroadcastRecipient[] = input.recipients.map((recipient) => ({
    id: createId('br'),
    campaignId: campaign.id,
    familyName: [recipient.familyName, recipient.personName].filter(Boolean).join(' - ') || 'Recipient',
    to: recipient.phoneE164,
    body: recipient.body || input.body,
    status: 'Not attempted',
    normalizedStatus: 'not_attempted',
    providerMessageId: '',
    providerStatus: '',
    errorMessage: '',
    rawProviderError: '',
    lastAttemptAt: '',
    createdAt: now,
    updatedAt: now
  }));

  await queryWithoutSchema([
    { sql: 'BEGIN' },
    {
      sql: 'INSERT INTO broadcast_campaigns (id, name, body, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [campaign.id, campaign.name, campaign.body, campaign.status, campaign.createdAt, campaign.updatedAt]
    },
    ...recipients.map((recipient) => ({
      sql: 'INSERT INTO broadcast_recipients (id, campaign_id, family_name, to_phone, body, status, provider_message_id, provider_status, error_message, raw_provider_error, last_attempt_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [recipient.id, recipient.campaignId, recipient.familyName, recipient.to, recipient.body, recipient.status, recipient.providerMessageId, recipient.providerStatus, recipient.errorMessage, recipient.rawProviderError, recipient.lastAttemptAt, recipient.createdAt, recipient.updatedAt]
    })),
    { sql: 'COMMIT' }
  ]);

  return { ...campaign, recipients };
}

export async function getBroadcastCampaign(campaignId: string) {
  const [result] = await query([{ sql: 'SELECT id, name, body, status, created_at, updated_at FROM broadcast_campaigns WHERE id = ? LIMIT 1', args: [campaignId] }]);
  const row = rowObjects(result)[0];
  return row ? campaignFromRow(row) : null;
}

async function getBroadcastRecipients(campaignId: string) {
  const [result] = await query([{ sql: 'SELECT id, campaign_id, family_name, to_phone, body, status, provider_message_id, provider_status, error_message, raw_provider_error, last_attempt_at, created_at, updated_at FROM broadcast_recipients WHERE campaign_id = ? ORDER BY created_at, id', args: [campaignId] }]);
  return rowObjects(result).map(recipientFromRow);
}

function buildAudit(campaign: BroadcastCampaign, recipients: BroadcastRecipient[]): CampaignAudit {
  const counts = recipients.reduce<CampaignAudit['counts']>((acc, recipient) => {
    const providerText = normalizeText(recipient.providerStatus);
    const providerStatusReachedTextgrid = /^(sent|queued|pending|delivered|undelivered|failed)$/.test(providerText);
    const reachedTextgrid = recipient.normalizedStatus !== 'failed_fetch' && (Boolean(recipient.providerMessageId) || providerStatusReachedTextgrid);
    acc.totalRecipients += 1;
    if (recipient.normalizedStatus === 'sent') acc.sent += 1;
    if (recipient.normalizedStatus === 'delivered') acc.delivered += 1;
    if (recipient.normalizedStatus === 'queued' || recipient.normalizedStatus === 'pending') acc.queuedPending += 1;
    if (['failed', 'failed_fetch', 'textgrid_http_400', 'undelivered'].includes(recipient.normalizedStatus)) acc.failed += 1;
    if (recipient.normalizedStatus === 'failed_fetch') acc.failedFetch += 1;
    if (recipient.normalizedStatus === 'textgrid_http_400') acc.textgridHttp400Failures += 1;
    if (recipient.normalizedStatus === 'undelivered') acc.undelivered += 1;
    if (reachedTextgrid) acc.reachedTextgrid += 1;
    if (recipient.normalizedStatus === 'not_attempted' || recipient.normalizedStatus === 'ready_to_send' || (!reachedTextgrid && recipient.normalizedStatus === 'other')) acc.notAttempted += 1;
    return acc;
  }, { totalRecipients: 0, sent: 0, delivered: 0, queuedPending: 0, failed: 0, failedFetch: 0, textgridHttp400Failures: 0, undelivered: 0, reachedTextgrid: 0, notAttempted: 0 });

  return { campaign: { id: campaign.id, name: campaign.name, body: campaign.body, status: campaign.status }, counts, recipients };
}

export async function getCampaignAudit(campaignId: string) {
  const campaign = await getBroadcastCampaign(campaignId);
  if (!campaign) throw new Error('Broadcast campaign not found.');
  const recipients = await getBroadcastRecipients(campaignId);
  return buildAudit(campaign, recipients);
}

export async function updateCampaignRecipientAttempt(campaignId: string, recipientId: string, input: {
  status: 'Sent' | 'Failed';
  providerMessageId?: string;
  providerStatus?: string;
  errorMessage?: string;
  rawProviderError?: string;
}) {
  await query([
    {
      sql: 'UPDATE broadcast_recipients SET status = ?, provider_message_id = ?, provider_status = ?, error_message = ?, raw_provider_error = ?, last_attempt_at = ?, updated_at = ? WHERE campaign_id = ? AND id = ?',
      args: [input.status, input.providerMessageId || '', input.providerStatus || '', input.errorMessage || '', input.rawProviderError || '', new Date().toISOString(), new Date().toISOString(), campaignId, recipientId]
    }
  ]);
}
