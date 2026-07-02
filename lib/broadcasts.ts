import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type CampaignRecipientStatus = 'delivered' | 'failed' | 'failed_fetch' | 'textgrid_http_400' | 'undelivered' | 'queued' | 'pending' | 'sent' | 'ready_to_send' | 'not_attempted' | 'other';

export type BroadcastRecipientInput = {
  familyName?: string;
  personName?: string;
  phoneE164: string;
  body?: string;
};

export type BroadcastRecipient = {
  id: string;
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
};

export type BroadcastCampaign = {
  id: string;
  name: string;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  recipients: BroadcastRecipient[];
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

type BroadcastStore = { campaigns: BroadcastCampaign[] };

const storePath = path.join(process.cwd(), '.data', 'broadcasts.json');

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
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

async function readStore(): Promise<BroadcastStore> {
  try {
    const text = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(text) as BroadcastStore;
    return { campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { campaigns: [] };
    throw error;
  }
}

async function writeStore(store: BroadcastStore) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2));
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
    updatedAt: now,
    recipients: input.recipients.map((recipient) => ({
      id: createId('br'),
      familyName: [recipient.familyName, recipient.personName].filter(Boolean).join(' - ') || 'Recipient',
      to: recipient.phoneE164,
      body: recipient.body || input.body,
      status: 'Not attempted',
      normalizedStatus: 'not_attempted',
      providerMessageId: '',
      providerStatus: '',
      errorMessage: '',
      rawProviderError: '',
      lastAttemptAt: ''
    }))
  };
  const store = await readStore();
  store.campaigns.unshift(campaign);
  await writeStore(store);
  return campaign;
}

export async function getBroadcastCampaign(campaignId: string) {
  const store = await readStore();
  return store.campaigns.find((campaign) => campaign.id === campaignId) || null;
}

function buildAudit(campaign: BroadcastCampaign): CampaignAudit {
  const recipients = campaign.recipients.map((recipient) => ({
    ...recipient,
    normalizedStatus: normalizeCampaignRecipientStatus(recipient.status, recipient.errorMessage, recipient.providerStatus)
  }));
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
  return buildAudit(campaign);
}

export async function updateCampaignRecipientAttempt(campaignId: string, recipientId: string, input: {
  status: 'Sent' | 'Failed';
  providerMessageId?: string;
  providerStatus?: string;
  errorMessage?: string;
  rawProviderError?: string;
}) {
  const store = await readStore();
  const campaign = store.campaigns.find((item) => item.id === campaignId);
  if (!campaign) throw new Error('Broadcast campaign not found.');
  const recipient = campaign.recipients.find((item) => item.id === recipientId);
  if (!recipient) throw new Error('Broadcast recipient not found.');
  recipient.status = input.status;
  recipient.providerMessageId = input.providerMessageId || '';
  recipient.providerStatus = input.providerStatus || '';
  recipient.errorMessage = input.errorMessage || '';
  recipient.rawProviderError = input.rawProviderError || '';
  recipient.lastAttemptAt = new Date().toISOString();
  recipient.normalizedStatus = normalizeCampaignRecipientStatus(recipient.status, recipient.errorMessage, recipient.providerStatus);
  campaign.updatedAt = new Date().toISOString();
  await writeStore(store);
}
