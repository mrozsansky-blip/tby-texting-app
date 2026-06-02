import { NextResponse } from 'next/server';
import { logInboundMessage } from '@/lib/airtable';
import { verifyTextgridWebhook } from '@/lib/textgrid';

export async function POST(request: Request) {
  const secret = request.headers.get('x-textgrid-secret');
  if (!verifyTextgridWebhook(secret)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  const payload = await request.json();
  const from = String(payload.from || payload.From || '');
  const body = String(payload.body || payload.message || payload.Body || '');
  const providerMessageId = String(payload.id || payload.messageId || '');

  if (!from || !body) {
    return NextResponse.json({ error: 'Webhook payload missing from/body.' }, { status: 400 });
  }

  const airtableMessageId = await logInboundMessage({ from, body, providerMessageId });
  return NextResponse.json({ ok: true, airtableMessageId });
}
