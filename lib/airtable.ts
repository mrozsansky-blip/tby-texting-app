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

export type PreviewRecipient = {
  familyId: string;
  familyName: string;
  phoneNumberRecordId: string;
  phoneE164: string;
  primaryForFamily: boolean;
};

export type GroupRecipientPreview = {
  group: SchoolGroup;
  planningMode: true;
  counts: {
    familiesFound: number;
    phonesFound: number;
    eligiblePhonesFound: number;
    dedupedRecipients: number;
    skippedReasons: Record<string, number>;
  };
  recipients: PreviewRecipient[];
  skippedReasons: Record<string, number>;
  notes: string[];
};

type AirtableRecord = Airtable.Record<Partial<Airtable.FieldSet>>;

function base() {
  const apiKey = getRequiredEnv('AIRTABLE_API_KEY');
  const baseId = getRequiredEnv('AIRTABLE_BASE_ID');
  return new Airtable({ apiKey }).base(baseId);
}

function firstText(record: AirtableRecord, fieldNames: string[], fallback = '') {
  for (const fieldName of fieldNames) {
    const value = record.get(fieldName);
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return fallback;
}

function countLinked(record: AirtableRecord, fieldNames: string[]) {
  for (const fieldName of fieldNames) {
    const value = record.get(fieldName);
    if (Array.isArray(value)) return value.length;
  }
  return 0;
}

function linkedRecordIds(record: AirtableRecord, fieldName: string): string[] {
  const value = record.get(fieldName);
  return Array.isArray(value) ? value.map(String) : [];
}

function checkbox(record: AirtableRecord, fieldName: string) {
  return Boolean(record.get(fieldName));
}

function addSkip(skippedReasons: Record<string, number>, reason: string) {
  skippedReasons[reason] = (skippedReasons[reason] || 0) + 1;
}

function normalizeGroupText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function gradeTokenFromGroupName(name: string) {
  const normalized = normalizeGroupText(name);
  const match = normalized.match(/^grade\s+(.+)$/);
  if (match?.[1]) return match[1].trim();
  if (normalized === 'primary') return 'primary';
  return '';
}

function studentGradeMatches(studentGrade: string, gradeToken: string) {
  const normalizedGrade = normalizeGroupText(studentGrade).replace(/^grade\s+/, '');
  const normalizedToken = normalizeGroupText(gradeToken).replace(/^grade\s+/, '');
  return normalizedGrade === normalizedToken || normalizedGrade.includes(normalizedToken);
}

async function listAllRecords(tableName: string, fields?: string[]) {
  return base()(tableName).select(fields ? { fields } : undefined).all() as Promise<AirtableRecord[]>;
}

async function findRecordsById(tableName: string, recordIds: string[]) {
  if (recordIds.length === 0) return [];

  const table = base()(tableName);
  const records = await Promise.all(recordIds.map((id) => table.find(id) as Promise<AirtableRecord>));
  return records;
}

function groupFromRecord(record: AirtableRecord): SchoolGroup {
  return {
    id: record.id,
    name: firstText(record, ['Group Name', 'Name'], 'Unnamed group'),
    type: firstText(record, ['Group Type', 'Type'], 'Manual'),
    rule: firstText(record, ['Description', 'Rule'], ''),
    familyCount: Number(record.get('Family Count') || countLinked(record, ['Families']) || 0),
    studentCount: countLinked(record, ['Students']),
    active: checkbox(record, 'Active')
  };
}

export async function listGroups(): Promise<SchoolGroup[]> {
  const tableName = process.env.AIRTABLE_GROUPS_TABLE || 'Communication Groups';
  const records = await base()(tableName).select({ maxRecords: 100 }).all();

  return records
    .map(groupFromRecord)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function familyIdsFromStudentRecords(studentRecords: AirtableRecord[]) {
  const familyIds = new Set<string>();
  for (const student of studentRecords) {
    for (const familyId of linkedRecordIds(student, 'FamilyKey')) familyIds.add(familyId);
  }
  return familyIds;
}

async function familyIdsForGroup(groupRecord: AirtableRecord) {
  const group = groupFromRecord(groupRecord);
  const notes: string[] = [];
  const familyIds = new Set<string>();
  const linkedFamilies = linkedRecordIds(groupRecord, 'Families');
  const linkedStudents = linkedRecordIds(groupRecord, 'Students');

  for (const familyId of linkedFamilies) familyIds.add(familyId);

  if (linkedStudents.length > 0) {
    const studentRecords = await findRecordsById('Students', linkedStudents);
    const studentFamilyIds = await familyIdsFromStudentRecords(studentRecords);
    for (const familyId of studentFamilyIds) familyIds.add(familyId);
  }

  if (familyIds.size > 0) {
    notes.push('Preview used the families/students linked on the Communication Groups record.');
    return { group, familyIds, notes };
  }

  const normalizedType = normalizeGroupText(group.type);
  const normalizedName = normalizeGroupText(group.name);

  if (normalizedType === 'all' || normalizedName === 'all families') {
    const familyRecords = await listAllRecords('Families', ['Family Display Name']);
    for (const family of familyRecords) familyIds.add(family.id);
    notes.push('Group has no linked families, so the All Families starter rule selected every family.');
    return { group, familyIds, notes };
  }

  const gradeToken = normalizedType === 'grade' ? gradeTokenFromGroupName(group.name) : '';
  if (gradeToken) {
    const students = await listAllRecords('Students', ['FamilyKey', 'Grade']);
    const matchedStudents = students.filter((student) => studentGradeMatches(firstText(student, ['Grade']), gradeToken));
    const studentFamilyIds = await familyIdsFromStudentRecords(matchedStudents);
    for (const familyId of studentFamilyIds) familyIds.add(familyId);
    notes.push(`Group has no linked families, so the grade starter rule matched students where Grade looks like "${gradeToken}".`);
    return { group, familyIds, notes };
  }

  notes.push('Group has no linked families/students and no safe starter rule. Preview returned zero recipients.');
  return { group, familyIds, notes };
}

export async function previewGroupRecipients(groupId: string): Promise<GroupRecipientPreview> {
  const groupTableName = process.env.AIRTABLE_GROUPS_TABLE || 'Communication Groups';
  const groupRecord = await base()(groupTableName).find(groupId) as AirtableRecord;
  const { group, familyIds, notes } = await familyIdsForGroup(groupRecord);
  const skippedReasons: Record<string, number> = {};

  const familyRecords = familyIds.size > 0 ? await findRecordsById('Families', Array.from(familyIds)) : [];
  const familyNamesById = new Map(familyRecords.map((family) => [family.id, firstText(family, ['Family Display Name', 'FamilyKey'], family.id)]));

  const phoneRecords = await listAllRecords('Phone Numbers', [
    'FamilyKey',
    'Phone E164',
    'SMS Allowed',
    'Do Not Contact',
    'Invalid / Bad Number',
    'Primary for Family'
  ]);

  const phonesForSelectedFamilies = phoneRecords.filter((phone) => {
    const phoneFamilyIds = linkedRecordIds(phone, 'FamilyKey');
    if (phoneFamilyIds.length === 0) {
      addSkip(skippedReasons, 'phone_missing_family');
      return false;
    }
    return phoneFamilyIds.some((familyId) => familyIds.has(familyId));
  });

  const eligiblePhonesByFamily = new Map<string, AirtableRecord[]>();

  for (const phone of phonesForSelectedFamilies) {
    const phoneFamilyIds = linkedRecordIds(phone, 'FamilyKey').filter((familyId) => familyIds.has(familyId));
    const phoneE164 = firstText(phone, ['Phone E164']);

    if (!phoneE164) {
      addSkip(skippedReasons, 'phone_missing_e164');
      continue;
    }

    if (!checkbox(phone, 'SMS Allowed')) {
      addSkip(skippedReasons, 'sms_not_allowed');
      continue;
    }

    if (checkbox(phone, 'Do Not Contact')) {
      addSkip(skippedReasons, 'do_not_contact');
      continue;
    }

    if (checkbox(phone, 'Invalid / Bad Number')) {
      addSkip(skippedReasons, 'invalid_bad_number');
      continue;
    }

    for (const familyId of phoneFamilyIds) {
      const existing = eligiblePhonesByFamily.get(familyId) || [];
      existing.push(phone);
      eligiblePhonesByFamily.set(familyId, existing);
    }
  }

  const recipients: PreviewRecipient[] = [];
  for (const familyId of familyIds) {
    const eligiblePhones = eligiblePhonesByFamily.get(familyId) || [];
    if (eligiblePhones.length === 0) {
      addSkip(skippedReasons, 'family_no_eligible_sms_phone');
      continue;
    }

    const selectedPhone = eligiblePhones.find((phone) => checkbox(phone, 'Primary for Family')) || eligiblePhones[0];
    recipients.push({
      familyId,
      familyName: familyNamesById.get(familyId) || familyId,
      phoneNumberRecordId: selectedPhone.id,
      phoneE164: firstText(selectedPhone, ['Phone E164']),
      primaryForFamily: checkbox(selectedPhone, 'Primary for Family')
    });

    if (eligiblePhones.length > 1) addSkip(skippedReasons, 'deduped_extra_family_phones');
  }

  return {
    group,
    planningMode: true,
    counts: {
      familiesFound: familyIds.size,
      phonesFound: phonesForSelectedFamilies.length,
      eligiblePhonesFound: Array.from(eligiblePhonesByFamily.values()).reduce((sum, phones) => sum + phones.length, 0),
      dedupedRecipients: recipients.length,
      skippedReasons
    },
    recipients,
    skippedReasons,
    notes
  };
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
