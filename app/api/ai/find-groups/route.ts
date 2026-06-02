import { NextResponse } from 'next/server';
import { suggestGroup } from '@/lib/ai';
import { listGroups } from '@/lib/airtable';

const fallbackGroups = ['Bus Route 4 Parents', 'Class 6B', 'Grade 4 Missing Trip Form', 'High School Parents', 'All Families'];

export async function POST(request: Request) {
  const { prompt } = await request.json();
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  let groupNames = fallbackGroups;
  try {
    const groups = await listGroups();
    if (groups.length) groupNames = groups.map((group) => group.name);
  } catch {}

  try {
    const result = await suggestGroup(prompt, groupNames);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      groupSuggestion: groupNames[0],
      reason: 'Fallback suggestion while AI is unavailable.',
      confidence: 'low',
      needsHumanReview: true
    });
  }
}
