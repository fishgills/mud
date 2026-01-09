import 'server-only';

const tryDecode = (input: string): string | null => {
  try {
    const decoded = Buffer.from(input, 'base64').toString('utf8');
    if (Buffer.from(decoded, 'utf8').toString('base64') === input) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
};

export const decodeMaybeBase64 = (value?: string): string | undefined => {
  if (!value) return value;
  const once = tryDecode(value);
  if (once !== null) {
    const twice = tryDecode(once);
    return twice !== null ? twice : once;
  }
  return value;
};
