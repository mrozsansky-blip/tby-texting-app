import { NextResponse } from 'next/server';
import { createBroadcastCampaign } from '@/lib/broadcasts';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name?: string;
      message?: string;
      recipients?: Array<{ familyName?: string; personName?: string; phoneE164?: string; body?: string }>;
    };
    const message = String(body.message || '').trim();
    const recipients = (body.recipients || []).filter((recipient) => recipient.phoneE164);

    if (!message) return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });
    if (recipients.length === 0) return NextResponse.json({ error: 'At least one recipient is required.' }, { status: 400 });

    const campaign = await createBroadcastCampaign({
      name: body.name?.trim() || `Broadcast ${new Date().toLocaleString()}`,
      body: message,
      recipients: recipients.map((recipient) => ({
        familyName: recipient.familyName,
        personName: recipient.personName,
        phoneE164: recipient.phoneE164!,
        body: recipient.body
      }))
    });

    return NextResponse.json({ campaignId: campaign.id, campaign });
  } catch (error) {
    return NextResponse.json({ error: 'Could not create broadcast campaign.', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
