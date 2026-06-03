import { NextResponse } from 'next/server';
import { logOutboundMessage } from '@/lib/airtable';
import { sendSms } from '@/lib/textgrid';

function isTextgridConfigured() {
  return Boolean(process.env.TEXTGRID_SEND_URL && process.env.TEXTGRID_API_KEY);
}

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
  const textgridConfigured = isTextgridConfigured();
  const logId = await logOutboundMessage({
    body: message,
    recipientGroup: recipientGroup || 'Manual selection',
    createdBy: confirmedBy || 'Unknown staff user',
    status: textgridConfigured ? 'queued' : 'draft'
  });

  if (!textgridConfigured) {
    return NextResponse.json({
      airtableMessageId: logId,
      planningMode: true,
      warning: 'Textgrid is not configured yet, so no SMS was sent. The message was saved to Airtable as a draft/planning record.',
      requested: recipients.length,
      deduplicated: uniqueRecipients.length,
      results: uniqueRecipients.map((to) => ({ to, status: 'not_sent_planning_mode' }))
    });
  }

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
    planningMode: false,
    requested: recipients.length,
    deduplicated: uniqueRecipients.length,
    results
  });
}
