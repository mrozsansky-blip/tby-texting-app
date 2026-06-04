import Airtable from 'airtable';
import { NextResponse } from 'next/server';
import { getRequiredEnv } from '@/lib/env';

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

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();

  if (query.length < 2) {
    return NextResponse.json({ phones: [], message: 'Enter at least 2 characters to search.' });
  }

  try {
    const phoneTable = process.env.AIRTABLE_PHONE_NUMBERS_TABLE || 'Phone Numbers';
    const records = await base()(phoneTable).select({
      maxRecords: 2000,
      fields: [
        'Display Builder',
        'FamilyKey',
        'PersonKey',
        'Phone Type',
        'Phone Number',
        'Phone E164',
        'Phone Display',
        'Raw Phone',
        'SMS Allowed',
        'Voice Allowed',
        'Do Not Contact',
        'Invalid / Bad Number'
      ]
    }).all();

    const normalizedQuery = query.toLowerCase();
    const queryDigits = digitsOnly(query);

    const phones = records
      .map((record) => {
        const display = stringValue(record.get('Display Builder')) || stringValue(record.get('Phone Display')) || stringValue(record.get('Phone Number')) || record.id;
        const phoneNumber = stringValue(record.get('Phone Number'));
        const phoneE164 = stringValue(record.get('Phone E164'));
        const rawPhone = stringValue(record.get('Raw Phone'));
        const phoneType = stringValue(record.get('Phone Type'));
        const familyIds = stringValue(record.get('FamilyKey'));
        const personIds = stringValue(record.get('PersonKey'));
        const searchableText = [display, phoneNumber, phoneE164, rawPhone, phoneType, familyIds, personIds].join(' ').toLowerCase();
        const searchableDigits = digitsOnly([phoneNumber, phoneE164, rawPhone, display].join(' '));

        return {
          id: record.id,
          display,
          phoneNumber,
          phoneE164,
          rawPhone,
          phoneType,
          familyIds,
          personIds,
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
