import Airtable from 'airtable';
import { getRequiredEnv } from './env';

export type SchoolGroup = {
  id: string;
  name: string;
  type: string;
  rule?: string;
  familyCount?: number;
};

function base() {
  const apiKey = getRequiredEnv('AIRTABLE_API_KEY');
  const baseId = getRequiredEnv('AIRTABLE_BASE_ID');
  return new Airtable({ apiKey }).base(baseId);
}

export async function listGroups(): Promise<SchoolGroup[]> {
  const tableName = process.env.AIRTABLE_GROUPS_TABLE || 'Groups';
  const records = await base()(tableName).select({ maxRecords: 100, sort: [{ field: 'Name', direction: 'asc' }] }).all();
  return records.map((record) => ({
    id: record.id,
    name: String(record.get('Name') || ''),
    type: String(record.get('Type') || 'Manual'),
    rule: String(record.get('Rule') || ''),
    familyCount: Number(record.get('Family Count') || 0)
  }));
}

export async function logOutboundMessage(input: {
  body: string;
  recipientGroup: string;
  createdBy: string;
  status: 'draft' | 'queued' | 'sent' | 'failed';
}) {
  const tableName = process.env.AIRTABLE_MESSAGES_TABLE || 'Messages';
  const [record] = await base()(tableName).create([
    {
      fields: {
        Body: input.body,
        'Recipient Group': input.recipientGroup,
        'Created By': input.createdBy,
        Status: input.status,
        Direction: 'Outbound'
      }
    }
  ]);
  return record.id;
}

export async function logInboundMessage(input: { from: string; body: string; providerMessageId?: string }) {
  const tableName = process.env.AIRTABLE_MESSAGES_TABLE || 'Messages';
  const [record] = await base()(tableName).create([
    {
      fields: {
        From: input.from,
        Body: input.body,
        'Provider Message ID': input.providerMessageId || '',
        Status: 'received',
        Direction: 'Inbound'
      }
    }
  ]);
  return record.id;
}
