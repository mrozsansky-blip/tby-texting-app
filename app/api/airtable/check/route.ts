import Airtable from 'airtable';
import { NextResponse } from 'next/server';

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
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) return null;
  return new Airtable({ apiKey }).base(baseId);
}

async function checkTable(tableName: string) {
  const base = getBase();
  if (!base) {
    return { tableName, readable: false, countInSample: 0, error: 'Airtable env vars are missing.' };
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
  const env = {
    AIRTABLE_API_KEY: Boolean(process.env.AIRTABLE_API_KEY),
    AIRTABLE_BASE_ID: Boolean(process.env.AIRTABLE_BASE_ID),
    TEXTGRID_SEND_URL: Boolean(process.env.TEXTGRID_SEND_URL),
    TEXTGRID_API_KEY: Boolean(process.env.TEXTGRID_API_KEY),
    planningMode: !(process.env.TEXTGRID_SEND_URL && process.env.TEXTGRID_API_KEY)
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
      groupsNote: groups?.countInSample === 0 ? 'Communication Groups is readable but currently has no sample records. Add groups before testing the Groups page.' : undefined,
      messagesWritableRecommendedTable: 'Message Campaigns',
      messagesTableReadable: Boolean(campaigns?.readable),
      textgridConnected: Boolean(process.env.TEXTGRID_SEND_URL && process.env.TEXTGRID_API_KEY)
    }
  });
}
