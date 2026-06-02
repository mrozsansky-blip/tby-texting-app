import { getRequiredEnv } from './env';

export type SendSmsInput = {
  to: string;
  body: string;
  from?: string;
  metadata?: Record<string, string>;
};

export async function sendSms(input: SendSmsInput) {
  const sendUrl = getRequiredEnv('TEXTGRID_SEND_URL');
  const apiKey = getRequiredEnv('TEXTGRID_API_KEY');

  const response = await fetch(sendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify({
      to: input.to,
      from: input.from,
      message: input.body,
      metadata: input.metadata
    })
  });

  if (!response.ok) {
    throw new Error('Textgrid send failed');
  }

  return response.json();
}

export function verifyTextgridWebhook(secretFromHeader: string | null) {
  const expected = process.env.TEXTGRID_WEBHOOK_SECRET;
  if (!expected) return true;
  return secretFromHeader === expected;
}
