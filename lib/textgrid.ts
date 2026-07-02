import { getUsableEnvValue } from './config';

export type SendSmsInput = {
  to: string;
  body: string;
  from?: string;
  metadata?: Record<string, string>;
};

export type TextgridSendResult = {
  ok: boolean;
  sandbox: boolean;
  httpStatus?: number;
  providerMessageId?: string;
  providerStatus?: string;
  errorMessage?: string;
  rawProviderError?: string;
};

function safeJson(value: unknown) {
  if (value === undefined) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.replace(/(api[_-]?key|authorization|token|secret|password)[^,}\n]*/gi, '$1:[redacted]').slice(0, 2000);
}

function messageIdFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  return String(record.id || record.messageId || record.message_id || record.sid || '');
}

function providerStatusFromPayload(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as Record<string, unknown>;
  return String(record.status || record.messageStatus || record.provider_status || fallback);
}

export async function sendSms(input: SendSmsInput): Promise<TextgridSendResult> {
  const sendEnabled = getUsableEnvValue('SMS_SEND_ENABLED') === 'true';
  const sendUrl = getUsableEnvValue('TEXTGRID_SEND_URL');
  const apiKey = getUsableEnvValue('TEXTGRID_API_KEY');

  if (!sendEnabled || !sendUrl || !apiKey) {
    return {
      ok: false,
      sandbox: true,
      providerStatus: 'sandbox_not_sent',
      errorMessage: 'SMS send skipped because live TextGrid sending is disabled or not configured.',
      providerMessageId: `sandbox-${Date.now()}`
    };
  }

  let payload: unknown;
  let responseText = '';
  try {
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

    responseText = await response.text();
    try {
      payload = responseText ? JSON.parse(responseText) : undefined;
    } catch {
      payload = responseText;
    }

    if (!response.ok) {
      return {
        ok: false,
        sandbox: false,
        httpStatus: response.status,
        providerStatus: `http_${response.status}`,
        errorMessage: `TextGrid send failed with HTTP ${response.status}`,
        rawProviderError: safeJson(payload || responseText)
      };
    }

    return {
      ok: true,
      sandbox: false,
      httpStatus: response.status,
      providerMessageId: messageIdFromPayload(payload),
      providerStatus: providerStatusFromPayload(payload, 'sent')
    };
  } catch (error) {
    return {
      ok: false,
      sandbox: false,
      providerStatus: 'failed_fetch',
      errorMessage: error instanceof Error ? error.message : 'TextGrid fetch failed',
      rawProviderError: safeJson(error instanceof Error ? error.message : error)
    };
  }
}

export function verifyTextgridWebhook(secretFromHeader: string | null) {
  const expected = process.env.TEXTGRID_WEBHOOK_SECRET;
  if (!expected) return true;
  return secretFromHeader === expected;
}
