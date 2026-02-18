# Getting Started with memstamp

This guide will help you get your first stamp created in under 5 minutes.

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

### 1. Get an API Key

Sign up at [memstamp.io](https://memstamp.io) to get your API key.

### 2. Create Your First Stamp

**TypeScript:**

```typescript
import { computeHash } from '@memstamp/core';

// Hash your content locally (raw content never leaves your environment)
const contentHash = computeHash({
  action: 'approved_loan',
  amount: 50000,
  customer_id: 'cust_123',
});

console.log(contentHash);
// sha256:a1b2c3d4e5f6...
```

**Python:**

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
print(f"Status: {stamp.status}")
```

### 3. Verify a Stamp

```python
result = client.verify(stamp.id)

if result.verified:
    print(f"✓ Verified on {result.chain}")
    print(f"  Transaction: {result.anchor_tx}")
else:
    print(f"✗ Verification failed: {result.error}")
```

## How It Works

1. **Your agent** generates events (decisions, tool calls, etc.)
2. **memstamp** hashes the content locally using SHA-256
3. **Only the hash** is sent to memstamp service (raw content stays with you)
4. memstamp **batches hashes** into a Merkle tree
5. The **Merkle root** is anchored to blockchain (Solana, Base, Bitcoin)
6. Anyone can **independently verify** stamps against the public chain

## Privacy Guarantee

Your raw content **never leaves your environment**. memstamp only receives:
- Content hash (SHA-256)
- Event type
- Agent ID
- Timestamp

## Next Steps

- [API Reference](./api-reference.md)
- [Verification Guide](./verification.md)
- [VCOT Schema Specification](../schemas/README.md)
- [LangChain Integration](./integrations/langchain.md)
