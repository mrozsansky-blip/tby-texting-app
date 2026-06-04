import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { message, recipients } = body;

  if (!message || !Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'Message and recipients are required.' }, { status: 400 });
  }

  const uniqueRecipients = Array.from(new Set(recipients.map(String)));

  return NextResponse.json({
    planningMode: true,
    providerConnected: false,
    warning: 'TextGrid is not connected. No SMS was sent and no Airtable message record was created.',
    requested: recipients.length,
    deduplicated: uniqueRecipients.length,
    results: uniqueRecipients.map((to) => ({ to, status: 'not_sent_provider_not_connected' }))
  });
}
