import { NextResponse } from 'next/server';
import { normalizeBroadcastAudienceType, normalizePhoneChoices, previewBroadcastRecipients } from '@/lib/airtable';

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') return value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const audienceType = normalizeBroadcastAudienceType(String(body.audienceType || 'all_families'));
    const audienceValue = String(body.audienceValue || '');
    const phoneChoices = normalizePhoneChoices(stringArray(body.phoneChoices));
    const manualPhoneRecordIds = stringArray(body.manualPhoneRecordIds || body.manualPhoneIds);

    const preview = await previewBroadcastRecipients({
      audienceType,
      audienceValue,
      phoneChoices,
      manualPhoneRecordIds
    });

    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Could not calculate broadcast recipient preview from Airtable.',
        details: error instanceof Error ? error.message : 'Unknown error',
        planningMode: true,
        providerConnected: false
      },
      { status: 500 }
    );
  }
}
