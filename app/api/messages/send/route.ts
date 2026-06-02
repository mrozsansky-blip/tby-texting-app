import { NextResponse } from 'next/server';
import { logOutboundMessage } from '@/lib/airtable';
import { sendSms } from '@/lib/textgrid';

export async function POST(request: Request) {
  const body = await request.json();
  const { message, recipients, recipientGroup, confirmedBy } = body;

  if (!message || !Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'Message and recipients are required.' }, { status: 400 });
  }

  if (!body.confirmed) {
    return NextResponse.json({ error: 'Human confirmation is required before sending.' }, { status: 400 });
  }

  const uniqueRecipients = Array.from(new Set(recipients.map(String)));
  const logId = await logOutboundMessage({
    body: message,
    recipientGroup: recipientGroup || 'Manual selection',
    createdBy: confirmedBy || 'Unknown staff user',
    status: 'queued'
  });

  const results = [];
  for (const to of uniqueRecipients) {
    try {
      const providerResult = await sendSms({ to, body: message, metadata: { airtableMessageId: logId } });
      results.push({ to, status: 'sent', providerResult });
    } catch (error) {
      results.push({ to, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return NextResponse.json({
    airtableMessageId: logId,
    requested: recipients.length,
    deduplicated: uniqueRecipients.length,
    results
  });
}
