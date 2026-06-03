export function isUsableEnvValue(value: string | undefined) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes('•')) return false;
  if (trimmed.toLowerCase() === 'placeholder') return false;
  if (trimmed.toLowerCase() === 'changeme') return false;
  if (trimmed.toLowerCase() === 'todo') return false;
  return /^[\x20-\x7E]+$/.test(trimmed);
}

export function getUsableEnvValue(name: string) {
  const value = process.env[name];
  return isUsableEnvValue(value) ? value!.trim() : undefined;
}

export function isTextgridConfigured() {
  return Boolean(getUsableEnvValue('TEXTGRID_SEND_URL') && getUsableEnvValue('TEXTGRID_API_KEY'));
}
