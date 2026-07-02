import { NextResponse } from 'next/server';
import { getCampaignAudit, updateCampaignRecipientAttempt } from '@/lib/airtable';
import { sendSms } from '@/lib/textgrid';

const SEND_CONCURRENCY = 5;
const NEVER_ORIGINAL_SEND = new Set(['sent', 'delivered', 'queued', 'pending', 'failed', 'failed_fetch', 'textgrid_http_400', 'undelivered']);
const NEVER_ORIGINAL_SEND_STATUS_TEXT = /\b(sent|delivered|queued|pending|failed|failed fetch|undelivered)\b|http\s*400/i;

async function runLimited<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += limit) {
    const batch = items.slice(index, index + limit);
    results.push(...await Promise.all(batch.map(worker)));
  }
  return results;
}

function isNeverAttemptedSendable(recipient: Awaited<ReturnType<typeof getCampaignAudit>>['recipients'][number]) {
  if (NEVER_ORIGINAL_SEND.has(recipient.normalizedStatus)) return false;
  if (recipient.providerMessageId || recipient.providerStatus || recipient.lastAttemptAt) return false;
  if (NEVER_ORIGINAL_SEND_STATUS_TEXT.test(recipient.status)) return false;
  return recipient.normalizedStatus === 'not_attempted' || recipient.normalizedStatus === 'ready_to_send';
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Campaign id is required.' }, { status: 400 });

    const audit = await getCampaignAudit(id);
    const sendableRecipients = audit.recipients.filter(isNeverAttemptedSendable);

    const results = await runLimited(sendableRecipients, SEND_CONCURRENCY, async (recipient) => {
      const result = await sendSms({
        to: recipient.to,
        body: recipient.body || audit.campaign.body,
        metadata: { campaignId: id, queueRecipientId: recipient.id, originalCampaignSend: 'true' }
      });

      await updateCampaignRecipientAttempt(recipient.id, {
        status: result.ok ? 'Sent' : 'Failed',
        providerMessageId: result.providerMessageId,
        providerStatus: result.providerStatus,
        errorMessage: result.errorMessage,
        rawProviderError: result.rawProviderError
      });

      return {
        id: recipient.id,
        status: result.ok ? 'sent' : 'failed',
        providerStatus: result.providerStatus,
        providerMessageId: result.providerMessageId,
        sandbox: result.sandbox,
        httpStatus: result.httpStatus,
        errorMessage: result.errorMessage
      };
    });

    return NextResponse.json({
      campaignId: id,
      sendScope: 'never_attempted_only',
      concurrency: SEND_CONCURRENCY,
      skippedAttemptedOrTerminalRows: audit.recipients.length - sendableRecipients.length,
      attempted: results.length,
      results
    });
  } catch (error) {
    return NextResponse.json({ error: 'Could not send campaign recipients.', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
