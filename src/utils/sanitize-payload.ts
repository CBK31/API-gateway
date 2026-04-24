const MASK_KEYS = new Set([
  'password',
  'otp',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'set-cookie',
  'card_number',
  'cvv',
  'cvc',
  'card_cvv',
  'card_cvc',
]);

const MAX_STRING_BYTES = 2 * 1024;
const MAX_PAYLOAD_BYTES = 100 * 1024;
const BASE64_PATTERN = /^data:[\w+-]+\/[\w+-]+;base64,/i;

function truncateString(str: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  if (bytes.length <= maxBytes) return str;
  const decoder = new TextDecoder();
  let end = maxBytes;
  while (end > 0 && (bytes[end - 1] & 0xc0) === 0x80) end--;
  return decoder.decode(bytes.subarray(0, end)) + '…[truncated]';
}

function byteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

export function sanitizePayload(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      if (BASE64_PATTERN.test(obj)) return '[BASE64_REDACTED]';
      return truncateString(obj, MAX_STRING_BYTES);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null
        ? sanitizePayload(item)
        : typeof item === 'string'
          ? BASE64_PATTERN.test(item)
            ? '[BASE64_REDACTED]'
            : truncateString(item, MAX_STRING_BYTES)
          : item,
    );
  }

  if (byteLength(obj) > MAX_PAYLOAD_BYTES) {
    return { truncated: true };
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (MASK_KEYS.has(lower)) {
      out[key] = '***';
      continue;
    }
    if (value === null || typeof value !== 'object') {
      if (typeof value === 'string') {
        out[key] = BASE64_PATTERN.test(value)
          ? '[BASE64_REDACTED]'
          : truncateString(value, MAX_STRING_BYTES);
      } else {
        out[key] = value;
      }
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? sanitizePayload(item)
          : typeof item === 'string'
            ? BASE64_PATTERN.test(item)
              ? '[BASE64_REDACTED]'
              : truncateString(item, MAX_STRING_BYTES)
            : item,
      );
      continue;
    }
    out[key] = sanitizePayload(value);
  }
  return out;
}
