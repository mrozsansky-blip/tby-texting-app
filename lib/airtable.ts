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
  name?: string;
};

const DEFAULT_PHONE_CHOICES: RecipientPhoneChoice[] = ['mother_cell', 'father_cell'];
const FAMILY_TABLE = process.env.AIRTABLE_FAMILIES_TABLE || 'Families';
const STUDENTS_TABLE = process.env.AIRTABLE_STUDENTS_TABLE || 'Students';
const PEOPLE_TABLE = process.env.AIRTABLE_PEOPLE_TABLE || 'People';
const PHONE_NUMBERS_TABLE = process.env.AIRTABLE_PHONE_NUMBERS_TABLE || 'Phone Numbers';
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

function stringValue(value: unknown): string {
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
    const studentRecords = await findRecordsById(STUDENTS_TABLE, linkedStudents);
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
    const familyRecords = await listAllRecords(FAMILY_TABLE, ['Family Display Name']);
    for (const family of familyRecords) familyIds.add(family.id);
    notes.push('Group has no linked families, so the All Families starter rule selected every family.');
    return { group, familyIds, notes };
  }

  const gradeToken = normalizedType === 'grade' ? gradeTokenFromGroupName(group.name) : '';
  if (gradeToken) {
    const students = await listAllRecords(STUDENTS_TABLE, ['FamilyKey', 'Grade']);
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
  const people = await listAllRecords(PEOPLE_TABLE, ['Full Name', 'Role', 'Title', 'Phone Numbers']);
  const peopleByPhone = new Map<string, PhonePersonInfo>();

  for (const person of people) {
    const info = {
      role: firstText(person, ['Role']),
      title: firstText(person, ['Title']),
      name: firstText(person, ['Full Name', 'Person Name', 'Name', 'Display Name', 'PersonKey'])
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

  const familyRecords = familyIds.size > 0 ? await findRecordsById(FAMILY_TABLE, Array.from(familyIds)) : [];
  const familyNamesById = new Map(familyRecords.map((family) => [family.id, firstText(family, ['Family Display Name', 'FamilyKey'], family.id)]));
  const personInfoByPhoneId = await peopleByPhoneNumberRecordId();

  const phoneRecords = await listAllRecords(PHONE_NUMBERS_TABLE, [
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

export type BroadcastAudienceType = 'all_families' | 'grade' | 'bus' | 'manual_list';

export type BroadcastRecipientRow = {
  id: string;
  familyId: string;
  familyName: string;
  personName?: string;
  phoneNumberRecordId: string;
  phoneE164: string;
  phoneType?: string;
  recipientPhoneChoice: RecipientPhoneChoice;
};

export type BroadcastSkippedRow = {
  id: string;
  familyId?: string;
  familyName?: string;
  phoneNumberRecordId?: string;
  phoneE164?: string;
  phoneType?: string;
  reason: string;
  detail: string;
};

export type BroadcastRecipientPreview = {
  planningMode: true;
  providerConnected: false;
  audience: {
    type: BroadcastAudienceType;
    value: string;
    label: string;
    busField?: string;
  };
  requestedPhoneChoices: RecipientPhoneChoice[];
  counts: {
    familiesFound: number;
    phonesFound: number;
    eligibleRecipients: number;
    skipped: number;
  };
  recipients: BroadcastRecipientRow[];
  skipped: BroadcastSkippedRow[];
  skippedReasons: Record<string, number>;
  notes: string[];
};

type BroadcastPreviewOptions = {
  audienceType: BroadcastAudienceType;
  audienceValue?: string;
  phoneChoices?: RecipientPhoneChoice[];
  manualPhoneRecordIds?: string[];
};

const AUDIENCE_TYPE_ALIASES: Record<string, BroadcastAudienceType> = {
  all: 'all_families',
  all_families: 'all_families',
  'all families': 'all_families',
  grade: 'grade',
  bus: 'bus',
  manual: 'manual_list',
  manual_list: 'manual_list',
  'manual list': 'manual_list'
};

export function normalizeBroadcastAudienceType(value: string): BroadcastAudienceType {
  return AUDIENCE_TYPE_ALIASES[normalizeGroupText(value)] || 'all_families';
}

function addSkippedRow(skipped: BroadcastSkippedRow[], skippedReasons: Record<string, number>, row: BroadcastSkippedRow) {
  skipped.push(row);
  addSkip(skippedReasons, row.reason);
}

function skippedDetail(reason: string) {
  const details: Record<string, string> = {
    phone_missing_family: 'Phone number is not linked to one of the selected families.',
    phone_missing_e164: 'Phone E164 is missing, so this number cannot be used for SMS.',
    sms_not_allowed: 'SMS Allowed is not checked for this phone number.',
    do_not_contact: 'Do Not Contact is checked for this phone number.',
    invalid_bad_number: 'Invalid / Bad Number is checked for this phone number.',
    duplicate_phone_removed: 'This E.164 number was already included once and was deduped.',
    family_no_eligible_sms_phone: 'Family has no phone number that passes the SMS safety filters.',
    no_mother_cell_for_family: 'No eligible mother cell matched the selected phone choices.',
    no_father_cell_for_family: 'No eligible father cell matched the selected phone choices.',
    no_parent_cell_for_family: 'No eligible parent cell matched the selected phone choices.',
    no_eligible_cell_phone_for_family: 'No eligible cell phone matched the selected phone choices.',
    no_primary_family_phone_for_family: 'No eligible primary family phone matched the selected phone choices.',
    manual_phone_not_found: 'Selected manual phone record could not be found in Airtable.',
    home_phone_is_voice_only_not_sms: 'Home phones are voice-only and are excluded from SMS preview.'
  };

  return details[reason] || reason.replace(/_/g, ' ');
}

function readableChoice(choice: RecipientPhoneChoice) {
  const labels: Record<RecipientPhoneChoice, string> = {
    primary_family: 'Primary family phone',
    mother_cell: 'Mother cell',
    father_cell: 'Father cell',
    home: 'Home phone',
    all_parent_cells: 'All parent cells',
    all_eligible_phones: 'All eligible phones'
  };

  return labels[choice];
}

function normalizeAudienceValue(value: string) {
  return value.trim().replace(/^grade\s+/i, '').replace(/^bus\s+/i, '').replace(/\s+families$/i, '').trim();
}

function busFieldFromStudents(students: AirtableRecord[]) {
  const preferred = ['Bus', 'Bus Route', 'Bus Number', 'Transportation Bus', 'Dismissal Bus', 'AM Bus', 'PM Bus'];
  const available = new Set<string>();

  for (const student of students) {
    for (const fieldName of Object.keys(student.fields || {})) {
      if (/bus/i.test(fieldName) && firstText(student, [fieldName])) available.add(fieldName);
    }
  }

  return preferred.find((fieldName) => available.has(fieldName)) || Array.from(available)[0] || '';
}

async function familiesForBroadcastAudience(audienceType: BroadcastAudienceType, audienceValue = '') {
  const notes: string[] = [];
  const familyIds = new Set<string>();
  let label = 'All Families';
  let busField = '';

  if (audienceType === 'all_families') {
    const families = await listAllRecords(FAMILY_TABLE);
    for (const family of families) familyIds.add(family.id);
    notes.push('All Families preview selected every family record from Airtable.');
    return { familyIds, label, busField, notes };
  }

  if (audienceType === 'grade') {
    const gradeToken = normalizeAudienceValue(audienceValue);
    label = gradeToken ? `Grade ${gradeToken}` : 'Grade';
    const students = await listAllRecords(STUDENTS_TABLE);
    const matchedStudents = gradeToken
      ? students.filter((student) => studentGradeMatches(firstText(student, ['Grade']), gradeToken))
      : [];
    const matchedFamilyIds = await familyIdsFromStudentRecords(matchedStudents);
    for (const familyId of matchedFamilyIds) familyIds.add(familyId);
    notes.push(gradeToken ? `Grade preview matched Students where Grade looks like "${gradeToken}".` : 'Enter a grade value, such as 4, to preview grade recipients.');
    return { familyIds, label, busField, notes };
  }

  if (audienceType === 'bus') {
    const busToken = normalizeAudienceValue(audienceValue);
    label = busToken ? `Bus ${busToken}` : 'Bus';
    const students = await listAllRecords(STUDENTS_TABLE);
    busField = busFieldFromStudents(students);

    if (!busField) {
      notes.push('No usable bus field with values was found on the Students table. Bus preview returned zero recipients.');
      return { familyIds, label, busField, notes };
    }

    const normalizedBusToken = normalizeGroupText(busToken);
    const matchedStudents = normalizedBusToken
      ? students.filter((student) => normalizeGroupText(firstText(student, [busField])).replace(/^bus\s+/, '') === normalizedBusToken)
      : [];
    const matchedFamilyIds = await familyIdsFromStudentRecords(matchedStudents);
    for (const familyId of matchedFamilyIds) familyIds.add(familyId);
    notes.push(busToken ? `Bus preview used Students field "${busField}" and matched value "${busToken}".` : `Students has a usable bus field ("${busField}"). Enter a bus value to preview recipients.`);
    return { familyIds, label, busField, notes };
  }

  label = audienceValue ? `Manual List (${audienceValue.split(',').filter(Boolean).length})` : 'Manual List';
  notes.push('Manual List preview uses Airtable phone records selected by office staff search.');
  return { familyIds, label, busField, notes };
}

function manualIdsFromValue(value = '') {
  return value.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean);
}

function phoneSafetyReason(phone: AirtableRecord) {
  if (!firstText(phone, ['Phone E164'])) return 'phone_missing_e164';
  if (!checkbox(phone, 'SMS Allowed')) return 'sms_not_allowed';
  if (checkbox(phone, 'Do Not Contact')) return 'do_not_contact';
  if (checkbox(phone, 'Invalid / Bad Number')) return 'invalid_bad_number';
  return '';
}

function choiceForPhone(phone: AirtableRecord, requestedPhoneChoices: RecipientPhoneChoice[], personInfo?: PhonePersonInfo) {
  return requestedPhoneChoices.find((choice) => matchesChoice(phone, choice, personInfo));
}

export async function previewBroadcastRecipients(options: BroadcastPreviewOptions): Promise<BroadcastRecipientPreview> {
  const audienceType = options.audienceType;
  const audienceValue = options.audienceValue || '';
  const requestedPhoneChoices = options.phoneChoices?.length ? options.phoneChoices : DEFAULT_PHONE_CHOICES;
  const skippedReasons: Record<string, number> = {};
  const skipped: BroadcastSkippedRow[] = [];
  const { familyIds, label, busField, notes } = await familiesForBroadcastAudience(audienceType, audienceValue);
  const manualPhoneRecordIds = audienceType === 'manual_list'
    ? Array.from(new Set([...(options.manualPhoneRecordIds || []), ...manualIdsFromValue(audienceValue)]))
    : [];

  const [familyRecords, personInfoByPhoneId, phoneRecords] = await Promise.all([
    familyIds.size > 0 ? findRecordsById(FAMILY_TABLE, Array.from(familyIds)) : Promise.resolve([]),
    peopleByPhoneNumberRecordId(),
    listAllRecords(PHONE_NUMBERS_TABLE)
  ]);

  const familyNamesById = new Map(familyRecords.map((family) => [family.id, firstText(family, ['Family Display Name', 'Family Name', 'Name', 'FamilyKey'], family.id)]));
  const phoneRecordsById = new Map(phoneRecords.map((phone) => [phone.id, phone]));
  const selectedPhones = audienceType === 'manual_list'
    ? manualPhoneRecordIds.map((id) => phoneRecordsById.get(id)).filter((phone): phone is AirtableRecord => Boolean(phone))
    : phoneRecords.filter((phone) => linkedRecordIds(phone, 'FamilyKey').some((familyId) => familyIds.has(familyId)));

  if (audienceType === 'manual_list') {
    const foundManualIds = new Set(selectedPhones.map((phone) => phone.id));
    for (const phoneId of manualPhoneRecordIds) {
      if (!foundManualIds.has(phoneId)) {
        addSkippedRow(skipped, skippedReasons, {
          id: `missing-${phoneId}`,
          phoneNumberRecordId: phoneId,
          reason: 'manual_phone_not_found',
          detail: skippedDetail('manual_phone_not_found')
        });
      }
    }

    const manualFamilyIds = new Set<string>();
    for (const phone of selectedPhones) {
      for (const familyId of linkedRecordIds(phone, 'FamilyKey')) manualFamilyIds.add(familyId);
    }
    if (manualFamilyIds.size > 0) {
      const manualFamilies = await findRecordsById(FAMILY_TABLE, Array.from(manualFamilyIds));
      for (const family of manualFamilies) familyNamesById.set(family.id, firstText(family, ['Family Display Name', 'Family Name', 'Name', 'FamilyKey'], family.id));
    }
    for (const familyId of manualFamilyIds) familyIds.add(familyId);
  }

  const recipients: BroadcastRecipientRow[] = [];
  const usedPhoneE164 = new Set<string>();
  const smsSafePhonesByFamily = new Map<string, AirtableRecord[]>();
  const matchedChoicesByFamily = new Map<string, Set<RecipientPhoneChoice>>();

  for (const phone of selectedPhones) {
    const familyRecordIds = linkedRecordIds(phone, 'FamilyKey');
    const phoneE164 = firstText(phone, ['Phone E164']);
    const phoneType = firstText(phone, ['Phone Type']);
    const safetyReason = phoneSafetyReason(phone);
    const relevantFamilyIds = audienceType === 'manual_list' ? familyRecordIds : familyRecordIds.filter((familyId) => familyIds.has(familyId));

    if (relevantFamilyIds.length === 0 && audienceType !== 'manual_list') {
      addSkippedRow(skipped, skippedReasons, { id: `skip-family-${phone.id}`, phoneNumberRecordId: phone.id, phoneE164, phoneType, reason: 'phone_missing_family', detail: skippedDetail('phone_missing_family') });
      continue;
    }

    if (safetyReason) {
      addSkippedRow(skipped, skippedReasons, { id: `skip-safe-${phone.id}`, familyId: relevantFamilyIds[0], familyName: familyNamesById.get(relevantFamilyIds[0]), phoneNumberRecordId: phone.id, phoneE164, phoneType, reason: safetyReason, detail: skippedDetail(safetyReason) });
      continue;
    }

    for (const familyId of relevantFamilyIds.length ? relevantFamilyIds : ['manual']) {
      const existing = smsSafePhonesByFamily.get(familyId) || [];
      existing.push(phone);
      smsSafePhonesByFamily.set(familyId, existing);
    }

    const personInfo = personInfoByPhoneId.get(phone.id);
    const matchedChoice = choiceForPhone(phone, requestedPhoneChoices, personInfo);
    if (!matchedChoice) {
      const reason = requestedPhoneChoices.length === 1 ? noMatchReason(requestedPhoneChoices[0]) : 'no_parent_cell_for_family';
      addSkippedRow(skipped, skippedReasons, { id: `skip-choice-${phone.id}`, familyId: relevantFamilyIds[0], familyName: familyNamesById.get(relevantFamilyIds[0]), phoneNumberRecordId: phone.id, phoneE164, phoneType, reason, detail: `${skippedDetail(reason)} Selected choices: ${requestedPhoneChoices.map(readableChoice).join(', ')}.` });
      continue;
    }

    for (const familyId of relevantFamilyIds.length ? relevantFamilyIds : ['manual']) {
      const existing = matchedChoicesByFamily.get(familyId) || new Set<RecipientPhoneChoice>();
      existing.add(matchedChoice);
      matchedChoicesByFamily.set(familyId, existing);
    }

    if (usedPhoneE164.has(phoneE164)) {
      addSkippedRow(skipped, skippedReasons, { id: `skip-dupe-${phone.id}`, familyId: relevantFamilyIds[0], familyName: familyNamesById.get(relevantFamilyIds[0]), phoneNumberRecordId: phone.id, phoneE164, phoneType, reason: 'duplicate_phone_removed', detail: skippedDetail('duplicate_phone_removed') });
      continue;
    }

    usedPhoneE164.add(phoneE164);
    recipients.push({
      id: phone.id,
      familyId: relevantFamilyIds[0] || 'manual',
      familyName: familyNamesById.get(relevantFamilyIds[0]) || 'Manual contact',
      personName: personInfo?.name,
      phoneNumberRecordId: phone.id,
      phoneE164,
      phoneType,
      recipientPhoneChoice: matchedChoice
    });
  }

  if (audienceType !== 'manual_list') {
    for (const familyId of familyIds) {
      if (!smsSafePhonesByFamily.has(familyId)) {
        addSkippedRow(skipped, skippedReasons, {
          id: `skip-empty-${familyId}`,
          familyId,
          familyName: familyNamesById.get(familyId) || familyId,
          reason: 'family_no_eligible_sms_phone',
          detail: skippedDetail('family_no_eligible_sms_phone')
        });
        continue;
      }

      const matchedChoices = matchedChoicesByFamily.get(familyId) || new Set<RecipientPhoneChoice>();
      for (const choice of requestedPhoneChoices) {
        if (!matchedChoices.has(choice)) {
          const reason = noMatchReason(choice);
          addSkippedRow(skipped, skippedReasons, {
            id: `skip-missing-${familyId}-${choice}`,
            familyId,
            familyName: familyNamesById.get(familyId) || familyId,
            reason,
            detail: skippedDetail(reason)
          });
        }
      }
    }
  }

  return {
    planningMode: true,
    providerConnected: false,
    audience: { type: audienceType, value: audienceValue, label, busField: busField || undefined },
    requestedPhoneChoices,
    counts: {
      familiesFound: familyIds.size,
      phonesFound: selectedPhones.length,
      eligibleRecipients: recipients.length,
      skipped: skipped.length
    },
    recipients,
    skipped,
    skippedReasons,
    notes: [
      ...notes,
      'Preview is read-only. TextGrid is not connected and no SMS is sent.',
      'Home phones are voice-only and are excluded from SMS preview.'
    ]
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

export type CampaignRecipientStatus = 'sent' | 'delivered' | 'queued' | 'pending' | 'failed' | 'failed_fetch' | 'textgrid_http_400' | 'other';

export type CampaignQueueRecipient = {
  id: string;
  familyName: string;
  to: string;
  body: string;
  status: string;
  normalizedStatus: CampaignRecipientStatus;
  providerMessageId: string;
  providerStatus: string;
  errorMessage: string;
  rawProviderError: string;
  lastAttemptAt: string;
};

export type CampaignAudit = {
  campaign: { id: string; name: string; body: string; status: string };
  counts: {
    totalRecipients: number;
    sent: number;
    delivered: number;
    queuedPending: number;
    failed: number;
    failedFetch: number;
    textgridHttp400Failures: number;
  };
  recipients: CampaignQueueRecipient[];
};

const MESSAGE_CAMPAIGNS_TABLE = process.env.AIRTABLE_MESSAGES_TABLE || 'Message Campaigns';
const MESSAGE_QUEUE_TABLE = process.env.AIRTABLE_MESSAGE_QUEUE_TABLE || 'Message Queue';

function linkedIdsFromAny(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object' && 'id' in item) return String((item as { id: unknown }).id);
    return String(item || '');
  }).filter(Boolean);
}

function fieldText(record: AirtableRecord, names: string[]) {
  return firstText(record, names);
}

function normalizeCampaignRecipientStatus(status: string, errorMessage = '', providerStatus = ''): CampaignRecipientStatus {
  const text = normalizeGroupText(`${status} ${errorMessage} ${providerStatus}`);
  if (/delivered/.test(text)) return 'delivered';
  if (/\bsent\b/.test(text)) return 'sent';
  if (/failed fetch/.test(text)) return 'failed_fetch';
  if (/http\s*400|\b400\b|bad request/.test(text)) return 'textgrid_http_400';
  if (/fail|error/.test(text)) return 'failed';
  if (/queue|pending|preview|draft|sending/.test(text)) return 'queued';
  return 'other';
}

function queueRecipientFromRecord(record: AirtableRecord, fallbackBody: string): CampaignQueueRecipient {
  const status = fieldText(record, ['Status']);
  const errorMessage = fieldText(record, ['Error Message', 'Provider Error', 'Error', 'Last Error']);
  const providerStatus = fieldText(record, ['Provider Status', 'TextGrid Status', 'Textgrid Status']);

  return {
    id: record.id,
    familyName: fieldText(record, ['Family Name', 'Family', 'Recipient Name', 'Name']),
    to: fieldText(record, ['To', 'Phone E164', 'Phone', 'Recipient Phone']),
    body: fieldText(record, ['Body', 'Message Body']) || fallbackBody,
    status,
    normalizedStatus: normalizeCampaignRecipientStatus(status, errorMessage, providerStatus),
    providerMessageId: fieldText(record, ['Provider Message ID', 'TextGrid Provider ID', 'TextGrid Message ID', 'provider_message_id']),
    providerStatus,
    errorMessage,
    rawProviderError: fieldText(record, ['Raw Provider Error', 'Provider Raw Error', 'raw_provider_error']),
    lastAttemptAt: fieldText(record, ['Last Attempt At', 'Last Attempt', 'last_attempt_at'])
  };
}

export async function getCampaignAudit(campaignId: string): Promise<CampaignAudit> {
  const campaignRecord = await base()(MESSAGE_CAMPAIGNS_TABLE).find(campaignId) as AirtableRecord;
  const campaignBody = fieldText(campaignRecord, ['Message Body', 'Body']);
  const queueRecords = await base()(MESSAGE_QUEUE_TABLE).select().all() as AirtableRecord[];
  const recipients = queueRecords
    .filter((record) => linkedIdsFromAny(record.get('Campaign')).includes(campaignId) || linkedIdsFromAny(record.get('Message Campaign')).includes(campaignId))
    .map((record) => queueRecipientFromRecord(record, campaignBody));

  const counts = recipients.reduce<CampaignAudit['counts']>((acc, recipient) => {
    acc.totalRecipients += 1;
    if (recipient.normalizedStatus === 'sent') acc.sent += 1;
    if (recipient.normalizedStatus === 'delivered') acc.delivered += 1;
    if (recipient.normalizedStatus === 'queued') acc.queuedPending += 1;
    if (recipient.normalizedStatus === 'failed' || recipient.normalizedStatus === 'failed_fetch' || recipient.normalizedStatus === 'textgrid_http_400') acc.failed += 1;
    if (recipient.normalizedStatus === 'failed_fetch') acc.failedFetch += 1;
    if (recipient.normalizedStatus === 'textgrid_http_400') acc.textgridHttp400Failures += 1;
    return acc;
  }, { totalRecipients: 0, sent: 0, delivered: 0, queuedPending: 0, failed: 0, failedFetch: 0, textgridHttp400Failures: 0 });

  return {
    campaign: {
      id: campaignRecord.id,
      name: fieldText(campaignRecord, ['Campaign Name', 'Name']) || campaignRecord.id,
      body: campaignBody,
      status: fieldText(campaignRecord, ['Status'])
    },
    counts,
    recipients
  };
}

async function updateQueueAttempt(recordId: string, fields: Partial<Airtable.FieldSet>) {
  await base()(MESSAGE_QUEUE_TABLE).update(recordId, fields);
}

export async function updateCampaignRecipientAttempt(recordId: string, input: {
  status: 'Sent' | 'Failed';
  providerMessageId?: string;
  providerStatus?: string;
  errorMessage?: string;
  rawProviderError?: string;
}) {
  await updateQueueAttempt(recordId, {
    Status: input.status,
    'Provider Message ID': input.providerMessageId || '',
    'Provider Status': input.providerStatus || '',
    'Error Message': input.errorMessage || '',
    'Raw Provider Error': input.rawProviderError || '',
    'Last Attempt At': new Date().toISOString()
  });
}
