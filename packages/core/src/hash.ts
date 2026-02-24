import { createHash } from 'crypto';

/**
 * Compute SHA-256 hash of content with RFC 8785 canonical JSON serialization
 */
export function computeHash(content: unknown): string {
  const canonical = canonicalJson(content);
  const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `sha256:${hash}`;
}

/**
 * RFC 8785 (JCS) canonical JSON serialization
 *
 * Implements JSON Canonicalization Scheme per RFC 8785:
 * - Deterministic key ordering (sorted by UTF-16 code units)
 * - No whitespace
 * - IEEE 754 number serialization (ES2015 ToString applied to Number)
 * - NFC-normalized strings
 * - Throws on BigInt, NaN, Infinity
 */
export function canonicalJson(value: unknown): string {
  return serializeValue(value);
}

function serializeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';

    case 'number':
      return serializeNumber(value);

    case 'string':
      return serializeString(value);

    case 'bigint':
      throw new TypeError(
        'BigInt values cannot be serialized to canonical JSON'
      );

    case 'object':
      if (Array.isArray(value)) {
        return serializeArray(value);
      }
      return serializeObject(value as Record<string, unknown>);

    case 'undefined':
    case 'function':
    case 'symbol':
      return 'null';

    default:
      throw new TypeError(
        `Unsupported type for canonical JSON: ${typeof value}`
      );
  }
}

function serializeNumber(value: number): string {
  if (Number.isNaN(value)) {
    throw new RangeError('NaN is not allowed in canonical JSON (RFC 8785)');
  }
  if (!Number.isFinite(value)) {
    throw new RangeError('Infinity is not allowed in canonical JSON (RFC 8785)');
  }

  if (Object.is(value, -0)) {
    return '0';
  }

  return String(value);
}

function serializeString(value: string): string {
  const normalized = value.normalize('NFC');
  let result = '"';

  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    switch (code) {
      case 0x08:
        result += '\\b';
        break;
      case 0x09:
        result += '\\t';
        break;
      case 0x0a:
        result += '\\n';
        break;
      case 0x0c:
        result += '\\f';
        break;
      case 0x0d:
        result += '\\r';
        break;
      case 0x22:
        result += '\\"';
        break;
      case 0x5c:
        result += '\\\\';
        break;
      default:
        if (code < 0x20) {
          result += '\\u' + code.toString(16).padStart(4, '0');
        } else {
          result += normalized[i];
        }
    }
  }

  result += '"';
  return result;
}

function serializeArray(arr: unknown[]): string {
  const items = arr.map((item) => serializeValue(item));
  return '[' + items.join(',') + ']';
}

function serializeObject(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort((a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });

  const pairs: string[] = [];
  for (const key of keys) {
    const val = obj[key];
    if (val === undefined || typeof val === 'function' || typeof val === 'symbol') {
      continue;
    }
    pairs.push(serializeString(key) + ':' + serializeValue(val));
  }

  return '{' + pairs.join(',') + '}';
}

/**
 * Compute event hash for chain linking
 */
export function computeEventHash(
  eventId: string,
  eventType: string,
  timestamp: string,
  agentId: string,
  contentHash: string,
  previousHash: string
): string {
  const data = `${eventId}|${eventType}|${timestamp}|${agentId}|${contentHash}|${previousHash}`;
  const hash = createHash('sha256').update(data, 'utf8').digest('hex');
  return `sha256:${hash}`;
}

/**
 * Genesis hash for first event in chain
 */
export const GENESIS_HASH = 'sha256:' + '0'.repeat(64);
