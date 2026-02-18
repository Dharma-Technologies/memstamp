import { randomBytes } from 'crypto';
import type { VCOTEvent, VCOTEventInput } from './types';
import { VCOT_VERSION } from './types';
import { computeHash, computeEventHash } from './hash';
import { signEventHash } from './signing';

/**
 * Generate a UUIDv7 (time-ordered UUID)
 */
function generateUUIDv7(): string {
  const now = Date.now();
  const timeBytes = new Uint8Array(6);
  // 48-bit timestamp in milliseconds
  timeBytes[0] = (now / 2 ** 40) & 0xff;
  timeBytes[1] = (now / 2 ** 32) & 0xff;
  timeBytes[2] = (now / 2 ** 24) & 0xff;
  timeBytes[3] = (now / 2 ** 16) & 0xff;
  timeBytes[4] = (now / 2 ** 8) & 0xff;
  timeBytes[5] = now & 0xff;

  const rand = randomBytes(10);

  // Set version 7 (0111) in rand_a high nibble
  rand[0] = (rand[0] & 0x0f) | 0x70;

  // Set variant 10xx in rand_b high bits
  rand[2] = (rand[2] & 0x3f) | 0x80;

  const hex =
    toHex(timeBytes[0]) +
    toHex(timeBytes[1]) +
    toHex(timeBytes[2]) +
    toHex(timeBytes[3]) +
    '-' +
    toHex(timeBytes[4]) +
    toHex(timeBytes[5]) +
    '-' +
    toHex(rand[0]) +
    toHex(rand[1]) +
    '-' +
    toHex(rand[2]) +
    toHex(rand[3]) +
    '-' +
    toHex(rand[4]) +
    toHex(rand[5]) +
    toHex(rand[6]) +
    toHex(rand[7]) +
    toHex(rand[8]) +
    toHex(rand[9]);

  return hex;
}

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

/**
 * Create a complete VCOT event from input
 */
export async function createVCOTEvent(
  input: VCOTEventInput,
  previousHash: string,
  privateKey: string
): Promise<VCOTEvent> {
  const eventId = generateUUIDv7();
  const timestamp = new Date().toISOString();
  const contentHash = computeHash(input.content);
  const framework = input.framework ?? 'unknown';

  const eventHash = computeEventHash(
    eventId,
    input.event_type,
    timestamp,
    input.agent_id,
    contentHash,
    previousHash
  );

  const signature = await signEventHash(eventHash, privateKey);

  return {
    version: VCOT_VERSION,
    event_id: eventId,
    event_type: input.event_type,
    timestamp,
    agent_id: input.agent_id,
    content_hash: contentHash,
    previous_hash: previousHash,
    framework,
    signature,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}
