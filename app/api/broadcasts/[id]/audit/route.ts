import { NextResponse } from 'next/server';
import { getCampaignAudit } from '@/lib/broadcasts';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Campaign id is required.' }, { status: 400 });
    return NextResponse.json(await getCampaignAudit(id));
  } catch (error) {
    return NextResponse.json({ error: 'Could not load campaign audit.', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
