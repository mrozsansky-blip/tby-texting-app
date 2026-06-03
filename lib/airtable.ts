import Airtable from 'airtable';
import { getRequiredEnv } from './env';

export type SchoolGroup = {
  id: string;
  name: string;
  type: string;
  rule?: string;
  familyCount?: number;
  studentCount?: number;
  active?: boolean;
};

function base() {
  const apiKey = getRequiredEnv('AIRTABLE_API_KEY');
  const baseId = getRequiredEnv('AIRTABLE_BASE_ID');
  return new Airtable({ apiKey }).base(baseId);
}

function firstText(record: Airtable.Record<Partial<Airtable.FieldSet>>, fieldNames: string[], fallback = '') {
  for (const fieldName of fieldNames) {
    const value = record.get(fieldName);
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return fallback;
}

function countLinked(record: Airtable.Record<Partial<Airtable.FieldSet>>, fieldNames: string[]) {
  for (const fieldName of fieldNames) {
    const value = record.get(fieldName);
    if (Array.isArray(value)) return value.length;
  }
  return 0;
}

export async function listGroups(): Promise<SchoolGroup[]> {
  const tableName = process.env.AIRTABLE_GROUPS_TABLE || 'Communication Groups';
  const records = await base()(tableName).select({ maxRecords: 100 }).all();

  return records
    .map((record) => ({
      id: record.id,
      name: firstText(record, ['Group Name', 'Name'], 'Unnamed group'),
      type: firstText(record, ['Group Type', 'Type'], 'Manual'),
      rule: firstText(record, ['Description', 'Rule'], ''),
      familyCount: Number(record.get('Family Count') || countLinked(record, ['Families']) || 0),
      studentCount: countLinked(record, ['Students']),
      active: Boolean(record.get('Active'))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function logOutboundMessage(input: {
  body: string;
  recipientGroup: string;
  createdBy: string;
  status: 'draft' | 'queued' | 'sent' | 'failed';
}) {
  const tableName = process.env.AIRTABLE_MESSAGES_TABLE || 'Message Campaigns';
  const [record] = await base()(tableName).create([
    {
      fields: {
        'Campaign Name': `Draft message - ${new Date().toISOString()}`,
        'Message Body': input.body,
        'Internal Notes': `Created by: ${input.createdBy}; group: ${input.recipientGroup}; status: ${input.status}`
      }
    }
  ]);
  return record.id;
}

export async function logInboundMessage(input: { from: string; body: string; providerMessageId?: string }) {
  const tableName = process.env.AIRTABLE_INBOUND_MESSAGES_TABLE || process.env.AIRTABLE_MESSAGES_TABLE || 'Message Campaigns';
  const [record] = await base()(tableName).create([
    {
      fields: {
        'Campaign Name': `Inbound message - ${new Date().toISOString()}`,
        'Message Body': input.body,
        'Internal Notes': `Inbound message from ${input.from}. Provider id: ${input.providerMessageId || 'none'}`
      }
    }
  ]);
  return record.id;
}
