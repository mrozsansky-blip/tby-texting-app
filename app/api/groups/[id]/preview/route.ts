import { NextResponse } from 'next/server';
import { previewGroupRecipients } from '@/lib/airtable';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Group id is required.' }, { status: 400 });
    }

    const preview = await previewGroupRecipients(id);
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
