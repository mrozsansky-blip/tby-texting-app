import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export async function composeSchoolSms(prompt: string) {
  const result = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({
      message: z.string().describe('A concise, warm SMS from a school office.'),
      tone: z.string(),
      safetyNote: z.string()
    }),
    prompt: `Draft a concise SMS for a school office. Never include private student details that were not provided. Staff prompt: ${prompt}`
  });
  return result.object;
}

export async function suggestGroup(prompt: string, availableGroups: string[]) {
  const result = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({
      groupSuggestion: z.string(),
      reason: z.string(),
      confidence: z.enum(['low', 'medium', 'high']),
      needsHumanReview: z.boolean()
    }),
    prompt: `A school staff member wants to send a message. Suggest the best recipient group from this list only: ${availableGroups.join(', ')}. Staff prompt: ${prompt}. Always require human review before sending.`
  });
  return result.object;
}
