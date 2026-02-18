# memstamp

> Verifiable audit trails for AI agents using the VCOT open standard.

**memstamp** lets any AI agent stamp its memory, decisions, and actions to a public blockchain — creating a tamper-proof audit trail that anyone can independently verify.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Why memstamp?

- **Immutable audit trails** — Every agent action anchored to blockchain
- **Trustless verification** — Anyone can verify without trusting memstamp
- **Privacy-preserving** — Only hashes leave your environment, never raw content
- **Chain-agnostic** — Solana, EVM chains (via EAS), Bitcoin
- **Open standard** — VCOT schema is vendor-neutral

## Quick Start

```bash
# Install the core library
npm install @memstamp/core

# Or use the full TypeScript SDK
npm install @memstamp/sdk

# Python SDK
pip install memstamp
```

### Create a Stamp

```typescript
import { createStamp, computeHash } from '@memstamp/core';

const stamp = createStamp({
  eventType: 'decision',
  agentId: 'my-agent-001',
  content: { action: 'approved_loan', amount: 50000 },
});

console.log(stamp.contentHash); // sha256:a1b2c3...
```

### Verify a Stamp

```typescript
import { verifyStamp } from '@memstamp/core';

const result = await verifyStamp(stampId, {
  chain: 'solana',
  rpc: 'https://api.mainnet-beta.solana.com',
});

console.log(result.verified); // true
console.log(result.anchorTx); // On-chain transaction
```

## Packages

| Package | Description |
|---------|-------------|
| `@memstamp/core` | Core library — VCOT schema, hashing, Merkle trees |
| `@memstamp/api` | Fastify REST API server |
| `@memstamp/worker` | Background chain anchoring worker |
| `memstamp` (Python) | Python SDK |

## Architecture

```
┌─ Your Agent ─────────────────────────────────────────┐
│                                                       │
│  Agent Runtime → @memstamp/core (hash locally)       │
│                  ↓                                    │
│  Only hashes sent to memstamp service                │
│  Raw content NEVER leaves your environment           │
└───────────────────┬───────────────────────────────────┘
                    │ HTTPS (hashes only)
                    ▼
┌─ memstamp Service ───────────────────────────────────┐
│  Batch events → Merkle tree → Anchor to blockchain   │
│  Solana (via Helius) | EVM (via EAS) | Bitcoin       │
└──────────────────────────────────────────────────────┘
```

## VCOT Schema

The **Verifiable Chain of Thought (VCOT)** schema is an open standard for AI agent auditability:

```typescript
interface VCOTEvent {
  version: "vcot/0.1";
  event_id: string;          // UUIDv7 (time-ordered)
  event_type: VCOTEventType;
  timestamp: string;          // ISO 8601 UTC
  agent_id: string;
  content_hash: string;       // sha256:<hex>
  previous_hash: string;      // Hash chain link
  framework: string;          // "openclaw/2026.2" etc.
  signature: string;          // Framework-signed
}
```

## Supported Chains

| Chain | Method | Status |
|-------|--------|--------|
| Solana | Memo program (via Helius) | ✅ |
| Base | EAS attestation | ✅ |
| Bitcoin | OP_RETURN | ✅ |
| Ethereum | EAS attestation | 🔜 |
| Arbitrum | EAS attestation | 🔜 |

## Compliance

memstamp helps satisfy audit requirements for:

- **SOC 2 Type II** — Audit trails, system monitoring
- **EU AI Act** — Automated logging, transparency
- **HIPAA** — Audit controls for health data
- **SEC Rule 17a-4** — Immutable record retention
- **GDPR Article 30** — Processing records

## Development

```bash
# Clone
git clone https://github.com/Dharma-Technologies/memstamp.git
cd memstamp

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start local dev (API + worker + Postgres + Redis)
docker compose up -d
```

## Documentation

- [Getting Started](docs/getting-started.md)
- [VCOT Schema Specification](schemas/README.md)
- [API Reference](docs/api-reference.md)
- [Verification Guide](docs/verification.md)

## License

MIT — see [LICENSE](LICENSE)

## Credits

Built by [Dharma Technologies](https://dharma.us) 🔮

**Key concept:** Agents don't need wallets. memstamp abstracts blockchain interaction completely.
