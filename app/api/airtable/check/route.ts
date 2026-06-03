import Airtable from 'airtable';
import { NextResponse } from 'next/server';
import { getUsableEnvValue, isTextgridConfigured } from '@/lib/config';

const TABLES = [
  'Families',
  'Students',
  'People',
  'Phone Numbers',
  'Communication Groups',
  'Message Campaigns',
  'Outbound Messages',
  'Message Queue'
];

function getBase() {
  const apiKey = getUsableEnvValue('AIRTABLE_API_KEY');
  const baseId = getUsableEnvValue('AIRTABLE_BASE_ID');
  if (!apiKey || !baseId) return null;
  return new Airtable({ apiKey }).base(baseId);
}

async function checkTable(tableName: string) {
  const base = getBase();
  if (!base) {
    return { tableName, readable: false, countInSample: 0, sampleRecordIds: [], error: 'Airtable env vars are missing, masked, or invalid.' };
  }

  try {
    const records = await base(tableName).select({ maxRecords: 5 }).all();
    return {
      tableName,
      readable: true,
      countInSample: records.length,
      sampleRecordIds: records.map((record) => record.id),
      error: null
    };
  } catch (error) {
    return {
      tableName,
      readable: false,
      countInSample: 0,
      sampleRecordIds: [],
      error: error instanceof Error ? error.message : 'Unknown Airtable error.'
    };
  }
}

export async function GET() {
  const textgridConfigured = isTextgridConfigured();
  const env = {
    AIRTABLE_API_KEY: Boolean(getUsableEnvValue('AIRTABLE_API_KEY')),
    AIRTABLE_BASE_ID: Boolean(getUsableEnvValue('AIRTABLE_BASE_ID')),
    TEXTGRID_SEND_URL: Boolean(getUsableEnvValue('TEXTGRID_SEND_URL')),
    TEXTGRID_API_KEY: Boolean(getUsableEnvValue('TEXTGRID_API_KEY')),
    planningMode: !textgridConfigured
  };

  const tables = await Promise.all(TABLES.map(checkTable));
  const groups = tables.find((table) => table.tableName === 'Communication Groups');
  const campaigns = tables.find((table) => table.tableName === 'Message Campaigns');

  return NextResponse.json({
    ok: env.AIRTABLE_API_KEY && env.AIRTABLE_BASE_ID && tables.every((table) => table.readable),
    env,
    expectedTables: TABLES,
    tables,
    checks: {
      groupsTableReturnsRecords: Boolean(groups && groups.readable && groups.countInSample > 0),
      groupsNote: groups && groups.readable && groups.countInSample === 0 ? 'Communication Groups is readable but currently has no sample records. Add groups before testing the Groups page.' : undefined,
      messagesWritableRecommendedTable: 'Message Campaigns',
      messagesTableReadable: Boolean(campaigns?.readable),
      textgridConnected: textgridConfigured
    }
  });
}
