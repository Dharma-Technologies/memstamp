// SHA-256 hashing with canonical JSON

import { createHash } from 'crypto';

/**
 * Compute SHA-256 hash of content with canonical JSON serialization
 */
export function computeHash(content: unknown): string {
  const canonical = canonicalJson(content);
  const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `sha256:${hash}`;
}

/**
 * Canonical JSON serialization
 * - Sorted keys
 * - No whitespace
 * - UTF-8 NFC normalized
 */
export function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj, sortKeys);
}

function sortKeys(_key: string, value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  return Object.keys(value as object)
    .sort()
    .reduce(
      (sorted, key) => {
        sorted[key] = (value as Record<string, unknown>)[key];
        return sorted;
      },
      {} as Record<string, unknown>
    );
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
