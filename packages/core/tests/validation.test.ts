import { describe, it, expect } from 'vitest';
import {
  validateVCOTEvent,
  validateHashChain,
  GENESIS_HASH,
  computeHash,
} from '../src/index';
import type { VCOTEvent } from '../src/index';

function makeValidEvent(overrides?: Partial<VCOTEvent>): VCOTEvent {
  return {
    version: 'vcot/0.1',
    event_id: '019c6ecf-b304-7f6e-9e79-b6d82aa8e0ae',
    event_type: 'decision',
    timestamp: '2026-02-18T00:00:00.000Z',
    agent_id: 'test-agent',
    content_hash: computeHash({ test: true }),
    previous_hash: GENESIS_HASH,
    framework: 'test/1.0',
    signature: 'a'.repeat(128),
    ...overrides,
  };
}

describe('Validation', () => {
  describe('validateVCOTEvent', () => {
    it('should accept valid event', () => {
      const result = validateVCOTEvent(makeValidEvent());
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject missing required field (event_id)', () => {
      const event = makeValidEvent();
      const { event_id: _, ...noId } = event;
      const result = validateVCOTEvent(noId);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject missing version', () => {
      const event = makeValidEvent();
      const { version: _, ...noVersion } = event;
      const result = validateVCOTEvent(noVersion);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid hash format', () => {
      const result = validateVCOTEvent(
        makeValidEvent({ content_hash: 'invalid-hash' })
      );
      expect(result.valid).toBe(false);
    });

    it('should reject invalid event_type', () => {
      const result = validateVCOTEvent(
        makeValidEvent({
          event_type: 'invalid_type' as VCOTEvent['event_type'],
        })
      );
      expect(result.valid).toBe(false);
    });

    it('should reject wrong version', () => {
      const result = validateVCOTEvent(
        makeValidEvent({
          version: 'vcot/999' as VCOTEvent['version'],
        })
      );
      expect(result.valid).toBe(false);
    });

    it('should reject empty agent_id', () => {
      const result = validateVCOTEvent(
        makeValidEvent({ agent_id: '' })
      );
      expect(result.valid).toBe(false);
    });

    it('should accept event with metadata', () => {
      const result = validateVCOTEvent(
        makeValidEvent({ metadata: { key: 'value' } })
      );
      expect(result.valid).toBe(true);
    });

    it('should accept all valid event types', () => {
      const types = [
        'decision',
        'tool_call',
        'tool_result',
        'memory_write',
        'memory_read',
        'external_action',
        'state_change',
        'observation',
        'custom',
      ] as const;
      for (const eventType of types) {
        const result = validateVCOTEvent(
          makeValidEvent({ event_type: eventType })
        );
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('validateHashChain', () => {
    it('should accept empty chain', () => {
      const result = validateHashChain([], GENESIS_HASH);
      expect(result.valid).toBe(true);
    });

    it('should accept valid chain starting from genesis', () => {
      const event1 = makeValidEvent({
        event_id: '019c6ecf-b304-7f6e-9e79-b6d82aa8e0a1',
        previous_hash: GENESIS_HASH,
        content_hash: computeHash({ step: 1 }),
      });
      const event2 = makeValidEvent({
        event_id: '019c6ecf-b304-7f6e-9e79-b6d82aa8e0a2',
        previous_hash: event1.content_hash,
        content_hash: computeHash({ step: 2 }),
      });
      const result = validateHashChain(
        [event1, event2],
        GENESIS_HASH
      );
      expect(result.valid).toBe(true);
    });

    it('should reject chain not starting from genesis', () => {
      const event = makeValidEvent({
        previous_hash: computeHash({ not: 'genesis' }),
      });
      const result = validateHashChain([event], GENESIS_HASH);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should detect broken chain link', () => {
      const event1 = makeValidEvent({
        event_id: '019c6ecf-b304-7f6e-9e79-b6d82aa8e0a1',
        previous_hash: GENESIS_HASH,
        content_hash: computeHash({ step: 1 }),
      });
      const event2 = makeValidEvent({
        event_id: '019c6ecf-b304-7f6e-9e79-b6d82aa8e0a2',
        previous_hash: computeHash({ wrong: 'link' }), // broken chain
        content_hash: computeHash({ step: 2 }),
      });
      const result = validateHashChain(
        [event1, event2],
        GENESIS_HASH
      );
      expect(result.valid).toBe(false);
      expect(result.errors![0]).toContain('does not chain correctly');
    });
  });
});
