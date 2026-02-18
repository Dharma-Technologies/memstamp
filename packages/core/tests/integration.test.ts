import { describe, it, expect } from 'vitest';
import {
  createVCOTEvent,
  generateKeyPair,
  GENESIS_HASH,
  computeHash,
  computeEventHash,
  computeMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  verifySignature,
  validateVCOTEvent,
  validateHashChain,
} from '../src/index';
import type { VCOTEvent } from '../src/index';

describe('Integration', () => {
  it('should create a chain of 10 events, build Merkle tree, and verify everything', async () => {
    const keys = await generateKeyPair();
    const events: VCOTEvent[] = [];
    let previousHash = GENESIS_HASH;

    // 1. Create chain of 10 events
    for (let i = 0; i < 10; i++) {
      const event = await createVCOTEvent(
        {
          event_type: 'decision',
          agent_id: 'integration-agent',
          content: { step: i, data: `action-${i}` },
          framework: 'test/1.0',
        },
        previousHash,
        keys.privateKey
      );
      events.push(event);
      previousHash = event.content_hash;
    }

    expect(events).toHaveLength(10);

    // 2. Validate all events against schema
    for (const event of events) {
      const result = validateVCOTEvent(event);
      expect(result.valid).toBe(true);
    }

    // 3. Validate hash chain integrity
    const chainResult = validateHashChain(events, GENESIS_HASH);
    expect(chainResult.valid).toBe(true);

    // 4. Verify all signatures
    for (const event of events) {
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
    }

    // 5. Build Merkle tree from content hashes
    const leaves = events.map((e) => e.content_hash);
    const root = computeMerkleRoot(leaves);
    expect(root).toMatch(/^sha256:[a-f0-9]{64}$/);

    // 6. Generate and verify proofs for all leaves
    for (let i = 0; i < leaves.length; i++) {
      const proof = generateMerkleProof(leaves, i);
      expect(proof).not.toBeNull();
      expect(proof!.root).toBe(root);
      expect(verifyMerkleProof(proof!)).toBe(true);
    }

    // 7. Verify tampered proof fails
    const proof = generateMerkleProof(leaves, 0)!;
    const tamperedProof = {
      ...proof,
      leaf: computeHash({ tampered: true }),
    };
    expect(verifyMerkleProof(tamperedProof)).toBe(false);
  });

  it('should detect broken chain when an event is modified', async () => {
    const keys = await generateKeyPair();
    const events: VCOTEvent[] = [];
    let previousHash = GENESIS_HASH;

    for (let i = 0; i < 5; i++) {
      const event = await createVCOTEvent(
        {
          event_type: 'tool_call',
          agent_id: 'integrity-agent',
          content: { action: i },
        },
        previousHash,
        keys.privateKey
      );
      events.push(event);
      previousHash = event.content_hash;
    }

    // Tamper with middle event's content_hash
    const tampered = [...events];
    tampered[2] = {
      ...tampered[2],
      content_hash: computeHash({ modified: true }),
    };

    const result = validateHashChain(tampered, GENESIS_HASH);
    expect(result.valid).toBe(false);
  });

  it('should support multiple agents with independent chains', async () => {
    const keys1 = await generateKeyPair();
    const keys2 = await generateKeyPair();

    // Agent 1 chain
    const event1a = await createVCOTEvent(
      {
        event_type: 'decision',
        agent_id: 'agent-1',
        content: { msg: 'hello from agent 1' },
      },
      GENESIS_HASH,
      keys1.privateKey
    );

    const event1b = await createVCOTEvent(
      {
        event_type: 'tool_call',
        agent_id: 'agent-1',
        content: { msg: 'agent 1 action' },
      },
      event1a.content_hash,
      keys1.privateKey
    );

    // Agent 2 chain
    const event2a = await createVCOTEvent(
      {
        event_type: 'observation',
        agent_id: 'agent-2',
        content: { msg: 'hello from agent 2' },
      },
      GENESIS_HASH,
      keys2.privateKey
    );

    // Both chains are independently valid
    expect(
      validateHashChain([event1a, event1b], GENESIS_HASH).valid
    ).toBe(true);
    expect(
      validateHashChain([event2a], GENESIS_HASH).valid
    ).toBe(true);

    // Cross-chain signatures don't verify
    const eventHash = computeEventHash(
      event1a.event_id,
      event1a.event_type,
      event1a.timestamp,
      event1a.agent_id,
      event1a.content_hash,
      event1a.previous_hash
    );
    expect(
      await verifySignature(
        eventHash,
        event1a.signature,
        keys2.publicKey
      )
    ).toBe(false);
    expect(
      await verifySignature(
        eventHash,
        event1a.signature,
        keys1.publicKey
      )
    ).toBe(true);
  });

  it('should handle all event types correctly', async () => {
    const keys = await generateKeyPair();
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

    let previousHash = GENESIS_HASH;
    const events: VCOTEvent[] = [];

    for (const eventType of types) {
      const event = await createVCOTEvent(
        {
          event_type: eventType,
          agent_id: 'multi-type-agent',
          content: { type: eventType },
        },
        previousHash,
        keys.privateKey
      );
      events.push(event);
      previousHash = event.content_hash;

      expect(validateVCOTEvent(event).valid).toBe(true);
    }

    expect(validateHashChain(events, GENESIS_HASH).valid).toBe(true);
  });
});
