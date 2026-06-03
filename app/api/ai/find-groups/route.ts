import { NextResponse } from 'next/server';
import { suggestGroup } from '@/lib/ai';
import { listGroups } from '@/lib/airtable';

export async function POST(request: Request) {
  const { prompt } = await request.json();
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  let groupNames: string[] = [];
  try {
    const groups = await listGroups();
    groupNames = groups.map((group) => group.name).filter(Boolean);
  } catch {
    return NextResponse.json({
      groupSuggestion: '',
      reason: 'Airtable groups could not be loaded, so no recipient group was suggested.',
      confidence: 'low',
      needsHumanReview: true
    });
  }

  if (groupNames.length === 0) {
    return NextResponse.json({
      groupSuggestion: '',
      reason: 'No Airtable groups exist yet. Create groups before using the AI group finder.',
      confidence: 'low',
      needsHumanReview: true
    });
  }

  try {
    const result = await suggestGroup(prompt, groupNames);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      groupSuggestion: '',
      reason: 'AI was unavailable, so no group was suggested. Please choose a group manually.',
      confidence: 'low',
      needsHumanReview: true
    });
  }
}
