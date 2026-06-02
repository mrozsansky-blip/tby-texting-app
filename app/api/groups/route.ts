import { NextResponse } from 'next/server';
import { listGroups } from '@/lib/airtable';

export async function GET() {
  try {
    const groups = await listGroups();
    return NextResponse.json({ groups });
  } catch (error) {
    return NextResponse.json({
      groups: [],
      warning: 'Airtable is not configured yet or could not be reached.'
    });
  }
}
