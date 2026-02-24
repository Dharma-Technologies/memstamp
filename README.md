# memstamp

> Verifiable audit trails for AI agents — the VCOT open standard.

We built memstamp because our clients needed a compliance framework for their AI agents. Regulators want audit trails. Enterprises want accountability. We realized this shouldn't be locked inside one product — it should be an open protocol the entire agentic economy can use.

**memstamp** lets any AI agent stamp its memory, decisions, and actions to a public blockchain — creating a tamper-proof audit trail that anyone can independently verify.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-69%20passing-brightgreen.svg)](#)

## How It Works

```
┌─ Your Agent ─────────────────────────────────────┐
│                                                   │
│  Agent Runtime → @memstamp/core (hash locally)   │
│                  ↓                                │
│  Only hashes leave your environment.             │
│  Raw content NEVER touches the network.          │
└───────────────────┬───────────────────────────────┘
                    │ HTTPS (hashes only)
                    ▼
┌─ memstamp Service ───────────────────────────────┐
│  Batch hashes → Merkle tree → Anchor to chain    │
│  Solana | EVM (Base, Ethereum) | Bitcoin         │
└──────────────────────────────────────────────────┘
```

1. Your agent generates events (decisions, tool calls, memory writes)
2. `@memstamp/core` hashes the content locally using SHA-256
3. Only the hash is sent to the memstamp service — raw content stays with you
4. Hashes are batched into a Merkle tree
5. The Merkle root is anchored to a public blockchain
6. Anyone can independently verify any stamp against the chain

## Why memstamp?

- **Privacy-preserving** — Only hashes leave your environment. Never raw content.
- **Chain-agnostic** — Solana, EVM chains (Base, Ethereum, Arbitrum), Bitcoin. Not locked to one chain.
- **Trustless verification** — Anyone can verify without trusting memstamp.
- **Open standard** — VCOT (Verifiable Chain of Thought) is a vendor-neutral schema. Use it with any framework.
- **Agents don't need wallets** — memstamp abstracts blockchain interaction completely.

## Quick Start

```bash
npm install @memstamp/core
```

### Create a Stamp

```typescript
import { computeHash, createVCOTEvent, generateKeyPair, GENESIS_HASH } from '@memstamp/core';

// Generate signing keys for your agent
const keys = await generateKeyPair();

// Create a verifiable event
const event = await createVCOTEvent(
  {
    event_type: 'decision',
    agent_id: 'loan-processor-001',
    content: { action: 'approved_loan', amount: 50000 },
    framework: 'langchain/0.1',
  },
  GENESIS_HASH, // previous hash (genesis for first event)
  keys.privateKey,
);

console.log(event.content_hash);  // sha256:a1b2c3d4...
console.log(event.event_id);      // UUIDv7 (time-ordered)
console.log(event.signature);     // Ed25519 signature
```

### Verify Hash Chains

```typescript
import { validateHashChain, GENESIS_HASH } from '@memstamp/core';

const result = validateHashChain(events, GENESIS_HASH);
console.log(result.valid); // true — chain integrity confirmed
```

### Build Merkle Trees

```typescript
import { computeMerkleRoot, generateMerkleProof, verifyMerkleProof } from '@memstamp/core';

const hashes = events.map(e => e.content_hash);
const root = computeMerkleRoot(hashes);  // This goes on-chain

// Generate proof for any individual stamp
const proof = generateMerkleProof(hashes, 0);
console.log(verifyMerkleProof(proof)); // true
```

## VCOT Schema

**Verifiable Chain of Thought (VCOT)** is an open standard for AI agent auditability:

```typescript
interface VCOTEvent {
  version: "vcot/0.1";
  event_id: string;          // UUIDv7 (time-ordered)
  event_type: VCOTEventType; // decision | tool_call | memory_write | ...
  timestamp: string;          // ISO 8601 UTC
  agent_id: string;
  content_hash: string;       // sha256:<hex> — your content, hashed locally
  previous_hash: string;      // Hash chain link to previous event
  framework: string;          // "langchain/0.1", "crewai/0.2", etc.
  signature: string;          // Ed25519 framework signature
}
```

Events form a cryptographic hash chain — each event references the previous one, making tampering detectable.

### Event Types

| Type | Description |
|------|-------------|
| `decision` | Agent made a choice |
| `tool_call` | Agent invoked a tool |
| `tool_result` | Tool returned a result |
| `memory_write` | Agent wrote to persistent memory |
| `memory_read` | Agent read from memory |
| `external_action` | Agent took an external action (API call, email, etc.) |
| `state_change` | Agent state transition |
| `observation` | Agent observed/ingested data |

## Supported Chains

| Chain | Method | Status |
|-------|--------|--------|
| Solana | Memo program (via Helius) | ✅ |
| Base | EAS attestation | ✅ |
| Bitcoin | OP_RETURN | ✅ |
| Ethereum | EAS attestation | 🔜 |
| Arbitrum | EAS attestation | 🔜 |

## Packages

| Package | Description |
|---------|-------------|
| [`@memstamp/core`](packages/core) | Core library — VCOT schema, hashing, Merkle trees, Ed25519 signing |
| [`@memstamp/api`](packages/api) | Fastify REST API server |
| [`@memstamp/worker`](packages/worker) | Background chain anchoring worker (BullMQ) |
| [`memstamp` (Python)](packages/python) | Python SDK with LangChain integration |

## Compliance

memstamp helps satisfy audit requirements across regulatory frameworks:

- **SOC 2 Type II** — Immutable audit trails, system monitoring
- **EU AI Act** — Automated logging, transparency obligations
- **HIPAA** — Audit controls for health data
- **SEC Rule 17a-4** — Immutable record retention
- **GDPR Article 30** — Processing activity records

## Development

```bash
git clone https://github.com/Dharma-Technologies/memstamp.git
cd memstamp

pnpm install
pnpm build    # Build all packages
pnpm test     # Run tests (69 passing)

# Local dev environment (API + worker + Postgres + Redis)
docker compose up -d
```

## Documentation

- [Getting Started](docs/getting-started.md)
- [VCOT Schema Specification](schemas/README.md)
- [API Reference](docs/api-reference.md)
- [Verification Guide](docs/verification.md)

## License

MIT — see [LICENSE](LICENSE)

---

Built by [Dharma Technologies](https://github.com/Dharma-Technologies)
