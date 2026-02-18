// VCOT Event validation
// Placeholder - implementation in P11-01

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { VCOT_SCHEMA_V1 } from './schema';
import type { VCOTEvent } from './types';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validateEvent = ajv.compile(VCOT_SCHEMA_V1);

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate a VCOT event against the schema
 */
export function validateVCOTEvent(event: unknown): ValidationResult {
  const valid = validateEvent(event);

  if (!valid) {
    return {
      valid: false,
      errors: validateEvent.errors?.map(
        (e) => `${e.instancePath} ${e.message}`
      ),
    };
  }

  return { valid: true };
}

/**
 * Validate event hash chain integrity
 */
export function validateHashChain(
  events: VCOTEvent[],
  genesisHash: string
): ValidationResult {
  if (events.length === 0) {
    return { valid: true };
  }

  // First event should reference genesis
  if (events[0].previous_hash !== genesisHash) {
    return {
      valid: false,
      errors: ['First event does not reference genesis hash'],
    };
  }

  // Each subsequent event should reference the previous event's content hash
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];

    // This is a simplified check - real implementation computes event_hash
    if (curr.previous_hash !== prev.content_hash) {
      return {
        valid: false,
        errors: [
          `Event ${curr.event_id} does not chain correctly from ${prev.event_id}`,
        ],
      };
    }
  }

  return { valid: true };
}
