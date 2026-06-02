import { NextResponse } from 'next/server';
import { composeSchoolSms } from '@/lib/ai';

export async function POST(request: Request) {
  const { prompt } = await request.json();
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  try {
    const result = await composeSchoolSms(prompt);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      message: 'Good afternoon, this is a reminder from the school office. Please review the details and contact us with any questions.',
      tone: 'fallback',
      safetyNote: 'AI was unavailable, so a safe generic draft was returned.'
    });
  }
}
