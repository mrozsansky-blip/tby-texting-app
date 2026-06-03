import { NextResponse } from 'next/server';
import { normalizePhoneChoices, previewGroupRecipients } from '@/lib/airtable';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Group id is required.' }, { status: 400 });
    }

    const url = new URL(request.url);
    const rawPhoneChoices = url.searchParams.get('phoneChoices') || '';
    const phoneChoices = normalizePhoneChoices(rawPhoneChoices.split(','));
    const preview = await previewGroupRecipients(id, { phoneChoices });
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Could not calculate recipient preview from Airtable.',
        details: error instanceof Error ? error.message : 'Unknown error',
        planningMode: true
      },
      { status: 500 }
    );
  }
}
