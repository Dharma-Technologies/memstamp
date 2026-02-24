# Getting Started with memstamp

Get your first verifiable audit stamp in under 5 minutes.

## Installation

### TypeScript / Node.js

```bash
npm install @memstamp/core
# or
pnpm add @memstamp/core
```

### Python

```bash
pip install memstamp
```

## Quick Start

### 1. Create a Signing Key Pair

Each agent (or framework) gets an Ed25519 key pair for signing events:

```typescript
import { generateKeyPair } from '@memstamp/core';

const keys = await generateKeyPair();
// Store keys.privateKey securely — you'll need it to sign events
// Publish keys.publicKey — verifiers use it to check signatures
```

### 2. Create Your First Stamp

```typescript
import { createVCOTEvent, GENESIS_HASH } from '@memstamp/core';

const event = await createVCOTEvent(
  {
    event_type: 'decision',
    agent_id: 'my-agent-001',
    content: { action: 'approved_loan', amount: 50000 },
    framework: 'my-framework/1.0',
  },
  GENESIS_HASH, // Use genesis hash for the first event in a chain
  keys.privateKey,
);

console.log(event.content_hash);  // sha256:a1b2c3...
console.log(event.signature);     // Ed25519 signature
```

### 3. Chain Events Together

Each event references the previous one, forming a tamper-evident chain:

```typescript
const secondEvent = await createVCOTEvent(
  {
    event_type: 'tool_call',
    agent_id: 'my-agent-001',
    content: { tool: 'search', query: 'interest rates' },
    framework: 'my-framework/1.0',
  },
  event.content_hash, // Links to previous event
  keys.privateKey,
);
```

### 4. Verify Chain Integrity

```typescript
import { validateHashChain, GENESIS_HASH } from '@memstamp/core';

const result = validateHashChain([event, secondEvent], GENESIS_HASH);
console.log(result.valid); // true
```

### 5. Build a Merkle Tree for Anchoring

```typescript
import { computeMerkleRoot, generateMerkleProof, verifyMerkleProof } from '@memstamp/core';

const hashes = [event.content_hash, secondEvent.content_hash];
const root = computeMerkleRoot(hashes);

// This root gets anchored to a blockchain
// Any individual stamp can be verified against it:
const proof = generateMerkleProof(hashes, 0);
console.log(verifyMerkleProof(proof!)); // true
```

### Python

```python
from memstamp import MemstampClient

client = MemstampClient(api_key="ms_live_xxx")

# Create a stamp
stamp = client.stamp(
    agent_id="loan-processor-001",
    event_type="decision",
    content={"action": "approved_loan", "amount": 50000}
)

print(f"Stamp ID: {stamp.id}")
print(f"Content hash: {stamp.content_hash}")

# Verify
result = client.verify(stamp.id)
print(f"Verified: {result.verified}")
```

## How It Works

1. **Your agent** generates events (decisions, tool calls, memory writes, etc.)
2. **@memstamp/core** hashes the content locally using SHA-256 with canonical JSON
3. **Only the hash** is sent to the memstamp service — raw content stays in your environment
4. The service **batches hashes** into a Merkle tree
5. The **Merkle root** is anchored to a public blockchain (Solana, Base, Bitcoin)
6. Anyone can **independently verify** stamps against the public chain

## Privacy Guarantee

Your raw content **never leaves your environment**. The only data that touches the network:

- Content hash (SHA-256)
- Event type
- Agent ID
- Timestamp

The content itself — your agent's decisions, tool calls, reasoning — stays with you.

## Next Steps

- [VCOT Schema Specification](../schemas/README.md) — understand the standard
- [API Reference](./api-reference.md) — server-side endpoints
- [Verification Guide](./verification.md) — how verification works end-to-end
