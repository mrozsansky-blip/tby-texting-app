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

type RedisResult<T> = { result?: T; error?: string };
type PipelineResult<T> = Array<{ result?: T; error?: string }>;

const keyPrefix = process.env.BROADCAST_STORAGE_PREFIX || 'tby:broadcasts';

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Persistent broadcast storage is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN (or Upstash Redis REST equivalents).');
  }
  return { url: url.replace(/\/$/, ''), token };
}

async function kvCommand<T>(command: unknown[]): Promise<T> {
  const { url, token } = kvConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  const payload = await response.json().catch(() => ({})) as RedisResult<T>;
  if (!response.ok || payload.error) throw new Error(payload.error || `Persistent broadcast storage failed with HTTP ${response.status}.`);
  return payload.result as T;
}

async function kvPipeline<T>(commands: unknown[][]): Promise<PipelineResult<T>> {
  const { url, token } = kvConfig();
  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  const payload = await response.json().catch(() => []) as PipelineResult<T> | RedisResult<PipelineResult<T>>;
  if (!response.ok) throw new Error(`Persistent broadcast storage pipeline failed with HTTP ${response.status}.`);
  const results = Array.isArray(payload) ? payload : payload.result;
  if (!results) throw new Error('Persistent broadcast storage pipeline returned no results.');
  const failed = results.find((item) => item.error);
  if (failed?.error) throw new Error(failed.error);
  return results;
}

function campaignKey(campaignId: string) {
  return `${keyPrefix}:campaign:${campaignId}`;
}

function campaignRecipientsKey(campaignId: string) {
  return `${keyPrefix}:campaign:${campaignId}:recipients`;
}

function recipientKey(campaignId: string, recipientId: string) {
  return `${keyPrefix}:campaign:${campaignId}:recipient:${recipientId}`;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as T;
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

export async function createBroadcastCampaign(input: { name: string; body: string; status?: string; recipients: BroadcastRecipientInput[] }) {
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

  await kvPipeline([
    ['SET', campaignKey(campaign.id), JSON.stringify(campaign)],
    ['DEL', campaignRecipientsKey(campaign.id)],
    ...(recipients.length > 0 ? [['RPUSH', campaignRecipientsKey(campaign.id), ...recipients.map((recipient) => recipient.id)]] : []),
    ...recipients.map((recipient) => ['SET', recipientKey(campaign.id, recipient.id), JSON.stringify(recipient)])
  ]);

  return { ...campaign, recipients };
}

export async function getBroadcastCampaign(campaignId: string) {
  const campaign = parseJson<BroadcastCampaign | null>(await kvCommand<string | null>(['GET', campaignKey(campaignId)]), null);
  return campaign;
}

async function getBroadcastRecipients(campaignId: string) {
  const ids = await kvCommand<string[]>(['LRANGE', campaignRecipientsKey(campaignId), 0, -1]);
  if (!ids.length) return [];
  const rows = await kvPipeline<string | null>(ids.map((id) => ['GET', recipientKey(campaignId, id)]));
  return rows
    .map((row) => parseJson<BroadcastRecipient | null>(row.result, null))
    .filter((recipient): recipient is BroadcastRecipient => Boolean(recipient))
    .map((recipient) => ({
      ...recipient,
      normalizedStatus: normalizeCampaignRecipientStatus(recipient.status, recipient.errorMessage, recipient.providerStatus)
    }));
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
  const existing = parseJson<BroadcastRecipient | null>(await kvCommand<string | null>(['GET', recipientKey(campaignId, recipientId)]), null);
  if (!existing) throw new Error('Broadcast recipient not found.');

  const updated: BroadcastRecipient = {
    ...existing,
    status: input.status,
    providerMessageId: input.providerMessageId || '',
    providerStatus: input.providerStatus || '',
    errorMessage: input.errorMessage || '',
    rawProviderError: input.rawProviderError || '',
    lastAttemptAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  updated.normalizedStatus = normalizeCampaignRecipientStatus(updated.status, updated.errorMessage, updated.providerStatus);

  await kvCommand(['SET', recipientKey(campaignId, recipientId), JSON.stringify(updated)]);
}
