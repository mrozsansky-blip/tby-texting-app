import Airtable from 'airtable';
import { NextResponse } from 'next/server';
import { getRequiredEnv } from '@/lib/env';

type AirtableRecord = Airtable.Record<Partial<Airtable.FieldSet>>;

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

function linkedRecordIds(record: AirtableRecord, fieldName: string): string[] {
  const value = record.get(fieldName);
  return Array.isArray(value) ? value.map(String) : [];
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

async function safeAllRecords(tableName: string) {
  try {
    return await base()(tableName).select({ maxRecords: 5000 }).all() as AirtableRecord[];
  } catch {
    return [];
  }
}

async function nameMaps() {
  const [people, families] = await Promise.all([
    safeAllRecords('People'),
    safeAllRecords('Families')
  ]);

  const personNames = new Map<string, string>();
  const familyNames = new Map<string, string>();

  for (const person of people) {
    personNames.set(person.id, firstText(person, ['Full Name', 'Person Name', 'Name', 'Display Name', 'PersonKey'], person.id));
  }

  for (const family of families) {
    familyNames.set(family.id, firstText(family, ['Family Display Name', 'Family Name', 'Name', 'FamilyKey'], family.id));
  }

  return { personNames, familyNames };
}

function namesFromIds(ids: string[], names: Map<string, string>) {
  return ids.map((id) => names.get(id) || id).filter(Boolean);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();

  if (query.length < 2) {
    return NextResponse.json({ phones: [], message: 'Enter at least 2 characters to search.' });
  }

  try {
    const phoneTable = process.env.AIRTABLE_PHONE_NUMBERS_TABLE || 'Phone Numbers';
    const [{ personNames, familyNames }, records] = await Promise.all([
      nameMaps(),
      base()(phoneTable).select({ maxRecords: 2000 }).all() as Promise<AirtableRecord[]>
    ]);

    const normalizedQuery = query.toLowerCase();
    const queryDigits = digitsOnly(query);

    const phones = records
      .map((record) => {
        const familyRecordIds = linkedRecordIds(record, 'FamilyKey');
        const personRecordIds = linkedRecordIds(record, 'PersonKey');
        const familyNameList = namesFromIds(familyRecordIds, familyNames);
        const personNameList = namesFromIds(personRecordIds, personNames);
        const familyName = familyNameList.join(', ');
        const personName = personNameList.join(', ');
        const phoneNumber = firstText(record, ['Phone Number']);
        const phoneE164 = firstText(record, ['Phone E164']);
        const rawPhone = firstText(record, ['Raw Phone']);
        const phoneType = firstText(record, ['Phone Type']);
        const airtableDisplay = firstText(record, ['Display Builder', 'Phone Display']);
        const display = [personName, familyName, phoneType, phoneE164 || phoneNumber || rawPhone]
          .filter(Boolean)
          .join(' • ') || airtableDisplay || record.id;
        const dropdownLabel = [personName || familyName || airtableDisplay || 'Unknown contact', phoneType, phoneE164 || phoneNumber || rawPhone]
          .filter(Boolean)
          .join(' — ');
        const searchableText = [display, dropdownLabel, phoneNumber, phoneE164, rawPhone, phoneType, familyName, personName, familyRecordIds.join(' '), personRecordIds.join(' ')].join(' ').toLowerCase();
        const searchableDigits = digitsOnly([phoneNumber, phoneE164, rawPhone, display].join(' '));

        return {
          id: record.id,
          display,
          dropdownLabel,
          personName,
          familyName,
          phoneNumber,
          phoneE164,
          rawPhone,
          phoneType,
          familyIds: familyRecordIds.join(', '),
          personIds: personRecordIds.join(', '),
          smsAllowed: Boolean(record.get('SMS Allowed')),
          voiceAllowed: Boolean(record.get('Voice Allowed')),
          doNotContact: Boolean(record.get('Do Not Contact')),
          invalidBadNumber: Boolean(record.get('Invalid / Bad Number')),
          searchableText,
          searchableDigits
        };
      })
      .filter((phone) => {
        const textMatch = phone.searchableText.includes(normalizedQuery);
        const digitMatch = queryDigits.length >= 2 && phone.searchableDigits.includes(queryDigits);
        return textMatch || digitMatch;
      })
      .slice(0, 25)
      .map(({ searchableText, searchableDigits, ...phone }) => phone);

    return NextResponse.json({ phones, query });
  } catch (error) {
    return NextResponse.json(
      {
        phones: [],
        error: 'Could not search Airtable phone numbers.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
