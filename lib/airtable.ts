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

export type RecipientPhoneChoice =
  | 'primary_family'
  | 'mother_cell'
  | 'father_cell'
  | 'home'
  | 'all_parent_cells'
  | 'all_eligible_phones';

export type PreviewRecipient = {
  familyId: string;
  familyName: string;
  phoneNumberRecordId: string;
  phoneE164: string;
  primaryForFamily: boolean;
  recipientPhoneChoice: RecipientPhoneChoice;
  phoneType?: string;
  personRole?: string;
  personTitle?: string;
};

export type GroupRecipientPreview = {
  group: SchoolGroup;
  planningMode: true;
  requestedPhoneChoices: RecipientPhoneChoice[];
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

type PreviewOptions = {
  phoneChoices?: RecipientPhoneChoice[];
};

type PhonePersonInfo = {
  role: string;
  title: string;
};

const DEFAULT_PHONE_CHOICES: RecipientPhoneChoice[] = ['mother_cell', 'father_cell'];
const VALID_PHONE_CHOICES = new Set<RecipientPhoneChoice>([
  'primary_family',
  'mother_cell',
  'father_cell',
  'home',
  'all_parent_cells',
  'all_eligible_phones'
]);

function base() {
  const apiKey = getRequiredEnv('AIRTABLE_API_KEY');
  const baseId = getRequiredEnv('AIRTABLE_BASE_ID');
  return new Airtable({ apiKey }).base(baseId);
}

function stringValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean).join(', ');
  if (typeof value === 'object' && 'name' in value) return String((value as { name: unknown }).name || '');
  return String(value);
}

function firstText(record: AirtableRecord, fieldNames: string[], fallback = '') {
  for (const fieldName of fieldNames) {
    const value = stringValue(record.get(fieldName));
    if (value) return value;
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

function normalizePhoneChoice(value: string): RecipientPhoneChoice | null {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases: Record<string, RecipientPhoneChoice> = {
    primary: 'primary_family',
    primary_family_phone: 'primary_family',
    primary_for_family: 'primary_family',
    mother: 'mother_cell',
    mother_phone: 'mother_cell',
    mom: 'mother_cell',
    mom_cell: 'mother_cell',
    father: 'father_cell',
    father_phone: 'father_cell',
    dad: 'father_cell',
    dad_cell: 'father_cell',
    home_phone: 'home',
    house: 'home',
    all_parents: 'all_parent_cells',
    parent_cells: 'all_parent_cells',
    all_parent_cell: 'all_parent_cells',
    all_phones: 'all_eligible_phones',
    all_eligible: 'all_eligible_phones'
  };

  const choice = aliases[normalized] || normalized;
  return VALID_PHONE_CHOICES.has(choice as RecipientPhoneChoice) ? (choice as RecipientPhoneChoice) : null;
}

export function normalizePhoneChoices(values: string[]): RecipientPhoneChoice[] {
  const choices = values
    .map(normalizePhoneChoice)
    .filter((choice): choice is RecipientPhoneChoice => Boolean(choice));

  return choices.length > 0 ? Array.from(new Set(choices)) : DEFAULT_PHONE_CHOICES;
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

function phoneMatchesMother(phoneType: string, personInfo?: PhonePersonInfo) {
  const text = normalizeGroupText(`${phoneType} ${personInfo?.role || ''} ${personInfo?.title || ''}`);
  return /\b(mother|mom|mommy|mrs|ms)\b/.test(text);
}

function phoneMatchesFather(phoneType: string, personInfo?: PhonePersonInfo) {
  const text = normalizeGroupText(`${phoneType} ${personInfo?.role || ''} ${personInfo?.title || ''}`);
  return /\b(father|dad|daddy|mr|rabbi)\b/.test(text);
}

function phoneMatchesHome(phoneType: string) {
  const text = normalizeGroupText(phoneType);
  return /\b(home|house|landline)\b/.test(text);
}

function phoneLooksLikeCell(phoneType: string) {
  const text = normalizeGroupText(phoneType);
  return /\b(cell|mobile|sms|text)\b/.test(text);
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

async function peopleByPhoneNumberRecordId() {
  const people = await listAllRecords('People', ['Role', 'Title', 'Phone Numbers']);
  const peopleByPhone = new Map<string, PhonePersonInfo>();

  for (const person of people) {
    const info = {
      role: firstText(person, ['Role']),
      title: firstText(person, ['Title'])
    };

    for (const phoneId of linkedRecordIds(person, 'Phone Numbers')) {
      if (!peopleByPhone.has(phoneId)) peopleByPhone.set(phoneId, info);
    }
  }

  return peopleByPhone;
}

function matchesChoice(phone: AirtableRecord, choice: RecipientPhoneChoice, personInfo?: PhonePersonInfo) {
  const phoneType = firstText(phone, ['Phone Type']);

  if (choice === 'primary_family') return checkbox(phone, 'Primary for Family');
  if (choice === 'mother_cell') return phoneMatchesMother(phoneType, personInfo) && phoneLooksLikeCell(phoneType);
  if (choice === 'father_cell') return phoneMatchesFather(phoneType, personInfo) && phoneLooksLikeCell(phoneType);
  if (choice === 'home') return false;
  if (choice === 'all_parent_cells') {
    return phoneLooksLikeCell(phoneType) && (phoneMatchesMother(phoneType, personInfo) || phoneMatchesFather(phoneType, personInfo));
  }
  return phoneLooksLikeCell(phoneType) && !phoneMatchesHome(phoneType);
}

function noMatchReason(choice: RecipientPhoneChoice) {
  if (choice === 'mother_cell') return 'no_mother_cell_for_family';
  if (choice === 'father_cell') return 'no_father_cell_for_family';
  if (choice === 'home') return 'home_phone_is_voice_only_not_sms';
  if (choice === 'all_parent_cells') return 'no_parent_cell_for_family';
  if (choice === 'all_eligible_phones') return 'no_eligible_cell_phone_for_family';
  return 'no_primary_family_phone_for_family';
}

export async function previewGroupRecipients(groupId: string, options: PreviewOptions = {}): Promise<GroupRecipientPreview> {
  const groupTableName = process.env.AIRTABLE_GROUPS_TABLE || 'Communication Groups';
  const requestedPhoneChoices = options.phoneChoices?.length ? options.phoneChoices : DEFAULT_PHONE_CHOICES;
  const groupRecord = await base()(groupTableName).find(groupId) as AirtableRecord;
  const { group, familyIds, notes } = await familyIdsForGroup(groupRecord);
  const skippedReasons: Record<string, number> = {};

  const familyRecords = familyIds.size > 0 ? await findRecordsById('Families', Array.from(familyIds)) : [];
  const familyNamesById = new Map(familyRecords.map((family) => [family.id, firstText(family, ['Family Display Name', 'FamilyKey'], family.id)]));
  const personInfoByPhoneId = await peopleByPhoneNumberRecordId();

  const phoneRecords = await listAllRecords('Phone Numbers', [
    'FamilyKey',
    'PersonKey',
    'Phone Type',
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
  const usedPhoneE164 = new Set<string>();

  function addRecipient(familyId: string, phone: AirtableRecord, recipientPhoneChoice: RecipientPhoneChoice) {
    const phoneE164 = firstText(phone, ['Phone E164']);
    if (usedPhoneE164.has(phoneE164)) {
      addSkip(skippedReasons, 'duplicate_phone_removed');
      return;
    }

    const personInfo = personInfoByPhoneId.get(phone.id);
    usedPhoneE164.add(phoneE164);
    recipients.push({
      familyId,
      familyName: familyNamesById.get(familyId) || familyId,
      phoneNumberRecordId: phone.id,
      phoneE164,
      primaryForFamily: checkbox(phone, 'Primary for Family'),
      recipientPhoneChoice,
      phoneType: firstText(phone, ['Phone Type']),
      personRole: personInfo?.role,
      personTitle: personInfo?.title
    });
  }

  for (const familyId of familyIds) {
    const eligiblePhones = eligiblePhonesByFamily.get(familyId) || [];
    if (eligiblePhones.length === 0) {
      addSkip(skippedReasons, 'family_no_eligible_sms_phone');
      continue;
    }

    for (const choice of requestedPhoneChoices) {
      if (choice === 'primary_family') {
        const selectedPhone = eligiblePhones.find((phone) => checkbox(phone, 'Primary for Family'));
        if (!selectedPhone) {
          addSkip(skippedReasons, 'no_primary_family_phone_for_family');
          continue;
        }

        addRecipient(familyId, selectedPhone, choice);
        continue;
      }

      const matchingPhones = eligiblePhones.filter((phone) => matchesChoice(phone, choice, personInfoByPhoneId.get(phone.id)));
      if (matchingPhones.length === 0) {
        addSkip(skippedReasons, noMatchReason(choice));
        continue;
      }

      for (const phone of matchingPhones) addRecipient(familyId, phone, choice);
    }
  }

  return {
    group,
    planningMode: true,
    requestedPhoneChoices,
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
