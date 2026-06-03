import Airtable from 'airtable';
import { NextResponse } from 'next/server';
import { getUsableEnvValue } from '@/lib/config';

function getBase() {
  const apiKey = getUsableEnvValue('AIRTABLE_API_KEY');
  const baseId = getUsableEnvValue('AIRTABLE_BASE_ID');
  if (!apiKey || !baseId) return null;
  return new Airtable({ apiKey }).base(baseId);
}

function getCreatedTime(record: Airtable.Record<Partial<Airtable.FieldSet>>) {
  const raw = record as unknown as { _rawJson?: { createdTime?: string } };
  return raw._rawJson?.createdTime || '';
}

export async function GET() {
  const base = getBase();
  if (!base) {
    return NextResponse.json({ error: 'Airtable env vars are missing or invalid.' }, { status: 500 });
  }

  try {
    const records = await base('Message Campaigns')
      .select({
        maxRecords: 20,
        fields: ['Campaign Name', 'Message Body', 'Internal Notes']
      })
      .all();

    const messages = records
      .map((record) => ({
        id: record.id,
        createdTime: getCreatedTime(record),
        campaignName: String(record.get('Campaign Name') || ''),
        messageBody: String(record.get('Message Body') || ''),
        internalNotes: String(record.get('Internal Notes') || '')
      }))
      .sort((a, b) => b.createdTime.localeCompare(a.createdTime))
      .slice(0, 10);

    return NextResponse.json({
      tableName: 'Message Campaigns',
      countReturned: messages.length,
      messages
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown Airtable error.' },
      { status: 500 }
    );
  }
}
