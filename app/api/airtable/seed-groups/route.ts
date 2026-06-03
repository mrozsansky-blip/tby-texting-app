import Airtable from 'airtable';
import { NextResponse } from 'next/server';
import { getUsableEnvValue } from '@/lib/config';

const STARTER_GROUPS = [
  {
    name: 'All Families',
    type: 'All',
    description: 'Starter group for all families. Families are not linked yet.'
  },
  {
    name: 'Grade 4',
    type: 'Grade',
    description: 'Starter test group for Grade 4 families. Families are not linked yet.'
  },
  {
    name: 'Grade 8',
    type: 'Grade',
    description: 'Starter test group for Grade 8 families. Families are not linked yet.'
  },
  {
    name: 'Primary',
    type: 'Grade',
    description: 'Starter test group for Primary families. Families are not linked yet.'
  },
  {
    name: 'Test Office Group',
    type: 'Manual',
    description: 'Starter manual office test group. Families are not linked yet.'
  }
];

function getBase() {
  const apiKey = getUsableEnvValue('AIRTABLE_API_KEY');
  const baseId = getUsableEnvValue('AIRTABLE_BASE_ID');
  if (!apiKey || !baseId) return null;
  return new Airtable({ apiKey }).base(baseId);
}

async function listExistingGroupNames(table: Airtable.Table<Partial<Airtable.FieldSet>>) {
  const records = await table.select({ maxRecords: 100, fields: ['Group Name'] }).all();
  return new Set(records.map((record) => String(record.get('Group Name') || '').trim()).filter(Boolean));
}

export async function GET() {
  return NextResponse.json({
    action: 'preview',
    tableName: 'Communication Groups',
    starterGroups: STARTER_GROUPS,
    note: 'Send a POST request to this route to create missing starter groups. No SMS will be sent.'
  });
}

export async function POST() {
  const base = getBase();
  if (!base) {
    return NextResponse.json({ error: 'Airtable env vars are missing or invalid.' }, { status: 500 });
  }

  const table = base('Communication Groups');
  const existingNames = await listExistingGroupNames(table);
  const groupsToCreate = STARTER_GROUPS.filter((group) => !existingNames.has(group.name));

  if (groupsToCreate.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped: STARTER_GROUPS.length,
      message: 'Starter groups already exist.'
    });
  }

  const createdRecords = await table.create(
    groupsToCreate.map((group) => ({
      fields: {
        'Group Name': group.name,
        'Group Type': group.type,
        Active: true,
        Description: group.description
      }
    })),
    { typecast: true }
  );

  return NextResponse.json({
    created: createdRecords.length,
    skipped: STARTER_GROUPS.length - groupsToCreate.length,
    createdRecordIds: createdRecords.map((record) => record.id),
    message: 'Starter groups created in Communication Groups. No families/students were linked and no SMS was sent.'
  });
}
