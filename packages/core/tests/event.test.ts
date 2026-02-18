import { describe, it, expect } from 'vitest';
import {
  createVCOTEvent,
  generateKeyPair,
  GENESIS_HASH,
  computeHash,
  validateVCOTEvent,
  verifySignature,
  computeEventHash,
} from '../src/index';

describe('Event Creation', () => {
  describe('createVCOTEvent', () => {
    it('should create a valid event that passes schema validation', async () => {
      const keys = await generateKeyPair();
      const event = await createVCOTEvent(
        {
          event_type: 'decision',
          agent_id: 'test-agent',
          content: { decision: 'approve' },
        },
        GENESIS_HASH,
        keys.privateKey
      );

      const validation = validateVCOTEvent(event);
      expect(validation.valid).toBe(true);
    });

    it('should produce valid UUIDv7 event_id', async () => {
      const keys = await generateKeyPair();
      const event = await createVCOTEvent(
        {
          event_type: 'tool_call',
          agent_id: 'agent-1',
          content: { tool: 'search' },
        },
        GENESIS_HASH,
        keys.privateKey
      );

      // UUIDv7 format: xxxxxxxx-xxxx-7xxx-[89ab]xxx-xxxxxxxxxxxx
      expect(event.event_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it('should generate valid ISO 8601 timestamp', async () => {
      const keys = await generateKeyPair();
      const before = new Date().toISOString();
      const event = await createVCOTEvent(
        {
          event_type: 'observation',
          agent_id: 'agent-1',
          content: 'observed',
        },
        GENESIS_HASH,
        keys.privateKey
      );
      const after = new Date().toISOString();

      expect(event.timestamp >= before).toBe(true);
      expect(event.timestamp <= after).toBe(true);
      // Verify it parses as valid date
      expect(new Date(event.timestamp).toISOString()).toBe(
        event.timestamp
      );
    });

    it('should compute deterministic content hash', async () => {
      const keys = await generateKeyPair();
      const content = { key: 'value', nested: { a: 1 } };
      const expectedHash = computeHash(content);

      const event = await createVCOTEvent(
        {
          event_type: 'memory_write',
          agent_id: 'agent-1',
          content,
        },
        GENESIS_HASH,
        keys.privateKey
      );

      expect(event.content_hash).toBe(expectedHash);
    });

    it('should set previous_hash correctly', async () => {
      const keys = await generateKeyPair();
      const prevHash = computeHash({ prev: 'event' });

      const event = await createVCOTEvent(
        {
          event_type: 'decision',
          agent_id: 'agent-1',
          content: 'data',
        },
        prevHash,
        keys.privateKey
      );

      expect(event.previous_hash).toBe(prevHash);
    });

    it('should use default framework when not provided', async () => {
      const keys = await generateKeyPair();
      const event = await createVCOTEvent(
        {
          event_type: 'decision',
          agent_id: 'agent-1',
          content: 'data',
        },
        GENESIS_HASH,
        keys.privateKey
      );

      expect(event.framework).toBe('unknown');
    });

    it('should use provided framework', async () => {
      const keys = await generateKeyPair();
      const event = await createVCOTEvent(
        {
          event_type: 'decision',
          agent_id: 'agent-1',
          content: 'data',
          framework: 'openclaw/2026.2',
        },
        GENESIS_HASH,
        keys.privateKey
      );

      expect(event.framework).toBe('openclaw/2026.2');
    });

    it('should include metadata when provided', async () => {
      const keys = await generateKeyPair();
      const event = await createVCOTEvent(
        {
          event_type: 'decision',
          agent_id: 'agent-1',
          content: 'data',
          metadata: { source: 'test', priority: 1 },
        },
        GENESIS_HASH,
        keys.privateKey
      );

      expect(event.metadata).toEqual({
        source: 'test',
        priority: 1,
      });
    });

    it('should not include metadata key when not provided', async () => {
      const keys = await generateKeyPair();
      const event = await createVCOTEvent(
        {
          event_type: 'decision',
          agent_id: 'agent-1',
          content: 'data',
        },
        GENESIS_HASH,
        keys.privateKey
      );

      expect('metadata' in event).toBe(false);
    });

    it('should produce verifiable signature', async () => {
      const keys = await generateKeyPair();
      const event = await createVCOTEvent(
        {
          event_type: 'tool_call',
          agent_id: 'agent-1',
          content: { tool: 'search', query: 'test' },
        },
        GENESIS_HASH,
        keys.privateKey
      );

      const eventHash = computeEventHash(
        event.event_id,
        event.event_type,
        event.timestamp,
        event.agent_id,
        event.content_hash,
        event.previous_hash
      );

      const valid = await verifySignature(
        eventHash,
        event.signature,
        keys.publicKey
      );
      expect(valid).toBe(true);
    });

    it('should chain events correctly', async () => {
      const keys = await generateKeyPair();

      const event1 = await createVCOTEvent(
        {
          event_type: 'decision',
          agent_id: 'agent-1',
          content: { step: 1 },
        },
        GENESIS_HASH,
        keys.privateKey
      );

      const event2 = await createVCOTEvent(
        {
          event_type: 'tool_call',
          agent_id: 'agent-1',
          content: { step: 2 },
        },
        event1.content_hash,
        keys.privateKey
      );

      expect(event2.previous_hash).toBe(event1.content_hash);
    });
  });
});
