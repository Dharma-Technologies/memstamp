# CLAUDE.md — memstamp

## Project
You are building **memstamp** — verifiable audit trails for AI agents using the VCOT open standard.

memstamp lets any AI agent stamp its memory, decisions, and actions to a public blockchain — creating a tamper-proof audit trail that anyone can independently verify.

## Working Directory
`/home/numen/dharma/memstamp/`

## Tech Stack

### Monorepo
- **Package Manager:** pnpm 8.x
- **Build System:** Turborepo
- **Structure:**
  - `packages/core` — @memstamp/core (TypeScript library)
  - `packages/api` — Fastify REST API
  - `packages/worker` — BullMQ background worker
  - `packages/python` — Python SDK (memstamp-py)

### TypeScript
- **Runtime:** Node.js 20+
- **Strict Mode:** Always enabled
- **Linting:** ESLint + Prettier
- **Testing:** Vitest
- **Build:** tsup (core), tsc (api/worker)

### API Server
- **Framework:** Fastify 4.x
- **Database:** PostgreSQL 16 (Drizzle ORM)
- **Cache/Queue:** Redis 7.x
- **Job Queue:** BullMQ
- **Auth:** API key + JWT
- **Docs:** OpenAPI/Swagger via @fastify/swagger

### Chain Integration
- **Solana:** @solana/web3.js + Helius RPC
- **EVM:** ethers.js v6 + Alchemy RPC + EAS SDK
- **Bitcoin:** bitcoinjs-lib (OP_RETURN)

### Core Library
- **Zero external deps** for core schema/hashing
- **Merkle trees:** Custom implementation
- **Signing:** Ed25519 via @noble/ed25519
- **Validation:** JSON Schema via ajv

### Python SDK
- **Python:** 3.10+
- **HTTP:** httpx
- **Types:** Pydantic v2
- **Linting:** ruff
- **Testing:** pytest

## Architecture Overview

```
┌─ Agent Environment (LOCAL) ────────────────────────────┐
│                                                         │
│  Agent Runtime → @memstamp/core (hash locally)         │
│                  ↓                                      │
│  Only SHA-256 hashes sent. Raw content NEVER leaves.   │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS
                      ▼
┌─ memstamp Service ──────────────────────────────────────┐
│                                                          │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────────┐ │
│  │ Fastify API  │  │ BullMQ     │  │ Chain Adapters   │ │
│  │              │→ │ Worker     │→ │ Solana/EVM/BTC   │ │
│  └──────────────┘  └────────────┘  └──────────────────┘ │
│                                                          │
│  ┌──────────────┐  ┌────────────────────────────────┐   │
│  │ PostgreSQL   │  │ Redis (queue + rate limiting)  │   │
│  └──────────────┘  └────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

## VCOT Schema (Verifiable Chain of Thought)

```typescript
interface VCOTEvent {
  version: "vcot/0.1";
  event_id: string;          // UUIDv7
  event_type: VCOTEventType; // decision | tool_call | memory_write | etc.
  timestamp: string;          // ISO 8601 UTC
  agent_id: string;
  content_hash: string;       // sha256:<hex>
  previous_hash: string;      // Hash chain link
  framework: string;          // "openclaw/2026.2" etc.
  signature: string;          // Ed25519 signature
}
```

## Database Models

### accounts
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| email | text | Account email |
| api_key_hash | text | Hashed API key |
| credits | integer | Credit balance |
| tier | text | free/pro/enterprise |
| created_at | timestamp | Creation time |

### stamps
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| account_id | uuid | Foreign key |
| event_id | text | VCOT event ID |
| agent_id | text | Agent identifier |
| event_type | text | Event type |
| content_hash | text | SHA-256 hash |
| previous_hash | text | Chain link |
| framework | text | Framework identifier |
| signature | text | Ed25519 signature |
| status | text | pending/anchored/verified |
| anchor_id | uuid | Foreign key (nullable) |
| created_at | timestamp | Creation time |

### anchors
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| merkle_root | text | Merkle root hash |
| event_count | integer | Number of events |
| start_time | timestamp | Batch start |
| end_time | timestamp | Batch end |
| chain | text | solana/base/bitcoin |
| tx_hash | text | Transaction hash |
| block_number | integer | Block number (nullable) |
| status | text | pending/confirmed/finalized |
| created_at | timestamp | Creation time |

### credits_transactions
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| account_id | uuid | Foreign key |
| amount | integer | Credit change (+/-) |
| type | text | purchase/deduct/refund |
| reason | text | Description |
| created_at | timestamp | Creation time |

## API Endpoints

### Stamps
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /v1/stamps | Create stamp(s) | API key |
| GET | /v1/stamps/:id | Get stamp by ID | API key |
| GET | /v1/stamps/:id/verify | Verify stamp | Public |
| GET | /v1/stamps/:id/proof | Get Merkle proof | API key |

### Agents
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /v1/agents/:id/stamps | List agent stamps | API key |
| GET | /v1/agents/:id/trail | Get audit trail | API key |
| GET | /v1/agents/:id/gaps | Gap detection | API key |

### Anchors
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /v1/anchors | List anchors | API key |
| GET | /v1/anchors/:id | Get anchor | API key |

### Accounts
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /v1/account | Get account info | API key |
| GET | /v1/account/credits | Get credit balance | API key |
| POST | /v1/account/credits/purchase | Purchase credits | API key |

### Public
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /v1/verify/:merkle_root | Public verification | None |
| GET | /v1/chains | Supported chains | None |
| GET | /health | Health check | None |

## Chain Credit Costs

| Chain | Credits/Stamp | Notes |
|-------|--------------|-------|
| Solana | 1 | Cheapest, fastest |
| Base | 2 | EAS attestation |
| Arbitrum | 3 | EAS attestation |
| Ethereum | 20 | EAS attestation |
| Bitcoin | 50 | OP_RETURN |

## CRITICAL RULES

### Security
1. **NEVER log or expose API keys** — only store hashed versions
2. **Raw content NEVER leaves client** — only content_hash
3. **Service wallet keys in env vars** — never hardcoded
4. **Rate limiting** on all endpoints
5. **Input validation** with Zod schemas

### Code Style
1. **TypeScript strict mode** — no any, no implicit any
2. **Explicit return types** on all functions
3. **Drizzle for database** — no raw SQL except migrations
4. **Zod for validation** — match JSON Schema
5. **Error handling** — custom error classes, proper HTTP codes

### Testing
1. **Unit tests** for core library (merkle, hash, signing)
2. **Integration tests** for API endpoints
3. **Mock chain interactions** in tests
4. **Test against devnet** for real chain tests

### Chain Integration
1. **Merkle tree batching** — configurable batch size (default 1000)
2. **Time window batching** — configurable window (default 5 min)
3. **Retry logic** for chain submissions
4. **Confirmation tracking** — wait for finality

## Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start local dev (needs Docker for Postgres + Redis)
docker compose up -d
pnpm --filter @memstamp/api dev

# Database commands
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Run migrations
pnpm db:push      # Push schema (dev only)

# Lint/format
pnpm lint
pnpm format
```

## Git Commands

```bash
cd /home/numen/dharma/memstamp
git add -A
git commit -m "feat: <description>"
git push origin main
```

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgres://memstamp:xxx@localhost:5432/memstamp
REDIS_URL=redis://localhost:6379
JWT_SECRET=xxx
HELIUS_API_KEY=xxx
ALCHEMY_API_KEY=xxx
SOLANA_PRIVATE_KEY=xxx  # Base58 encoded
EVM_PRIVATE_KEY=xxx     # 0x prefixed
```

---

## Current Stage: P11-06-verification-docs

# P11-06: Verification & Documentation

**Phase 6 — Public Verification & Documentation**

Implement public verification endpoints and complete documentation.

---

## Stories

### Story 1: Public Verification Endpoint
**File:** `packages/api/src/routes/public.ts`

Implement `GET /v1/verify/:merkle_root` — no authentication required.

**Response:**
```typescript
{
  verified: boolean;
  merkle_root: string;
  anchor?: {
    id: string;
    chain: string;
    tx_hash: string;
    block_number?: number;
    status: string;
    event_count: number;
    anchored_at: string;
  };
  chain_proof?: {
    verified: boolean;
    explorer_url: string;
  };
  error?: string;
}
```

**Logic:**
1. Look up anchor by merkle_root
2. If found, verify against chain
3. Return verification status with proof

**Implementation:**
```typescript
app.get('/v1/verify/:merkle_root', {
  schema: {
    params: z.object({
      merkle_root: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    }),
    response: {
      200: VerifyResponseSchema,
    },
  },
}, async (request) => {
  const { merkle_root } = request.params;
  
  // Find anchor
  const anchor = await anchorRepo.findByMerkleRoot(merkle_root);
  
  if (!anchor) {
    return {
      verified: false,
      merkle_root,
      error: 'Merkle root not found in any anchor',
    };
  }
  
  // Verify on chain
  let chainProof = null;
  if (anchor.txHash) {
    const adapter = getChainAdapter(anchor.chain);
    const verified = await adapter.verifyAnchor(merkle_root, anchor.txHash);
    
    chainProof = {
      verified,
      explorer_url: getExplorerUrl(anchor.chain, anchor.txHash),
    };
  }
  
  return {
    verified: anchor.status !== 'pending' && (chainProof?.verified ?? false),
    merkle_root,
    anchor: {
      id: anchor.id,
      chain: anchor.chain,
      tx_hash: anchor.txHash,
      block_number: anchor.blockNumber,
      status: anchor.status,
      event_count: anchor.eventCount,
      anchored_at: anchor.createdAt.toISOString(),
    },
    chain_proof: chainProof,
  };
});

function getExplorerUrl(chain: string, txHash: string): string {
  switch (chain) {
    case 'solana':
      return `https://solscan.io/tx/${txHash}`;
    case 'base':
      return `https://basescan.org/tx/${txHash}`;
    case 'ethereum':
      return `https://etherscan.io/tx/${txHash}`;
    case 'arbitrum':
      return `https://arbiscan.io/tx/${txHash}`;
    case 'bitcoin':
      return `https://blockstream.info/tx/${txHash}`;
    default:
      return '';
  }
}
```

---

### Story 2: Stamp Verification by Hash
**File:** `packages/api/src/routes/public.ts`

Implement `GET /v1/verify/stamp/:content_hash` — verify by content hash.

**Response:**
```typescript
{
  verified: boolean;
  content_hash: string;
  stamp?: {
    id: string;
    event_id: string;
    agent_id: string;
    event_type: string;
    status: string;
    created_at: string;
  };
  merkle_proof?: MerkleProof;
  anchor?: AnchorInfo;
  chain_proof?: ChainProof;
  error?: string;
}
```

**Logic:**
1. Find stamp by content_hash
2. If found, get its Merkle proof
3. Verify proof against anchor
4. Verify anchor against chain

---

### Story 3: Independent Verification Tool
**File:** `packages/core/src/verify.ts`

Create standalone verification functions for independent auditing.

```typescript
/**
 * Verify a stamp independently using only:
 * - The stamp data
 * - The Merkle proof
 * - Direct chain access
 * 
 * No memstamp service dependency.
 */
export async function verifyStampIndependently(
  stamp: VCOTEvent,
  merkleProof: MerkleProof,
  chainRpcUrl: string,
  txHash: string
): Promise<IndependentVerificationResult> {
  const results: IndependentVerificationResult = {
    verified: false,
    checks: {
      event_hash_valid: false,
      merkle_proof_valid: false,
      chain_anchor_valid: false,
      signature_valid: false,
    },
    errors: [],
  };
  
  // 1. Verify event hash matches content
  const computedEventHash = computeEventHash(
    stamp.event_id,
    stamp.event_type,
    stamp.timestamp,
    stamp.agent_id,
    stamp.content_hash,
    stamp.previous_hash
  );
  results.checks.event_hash_valid = true; // Hash computation is deterministic
  
  // 2. Verify Merkle proof
  results.checks.merkle_proof_valid = verifyMerkleProof({
    leaf: stamp.content_hash,
    proof: merkleProof.proof,
    root: merkleProof.root,
  });
  
  if (!results.checks.merkle_proof_valid) {
    results.errors.push('Merkle proof verification failed');
  }
  
  // 3. Verify chain anchor
  // This would require chain-specific RPC calls
  // Simplified for now
  results.checks.chain_anchor_valid = await verifyOnChain(
    merkleProof.root,
    chainRpcUrl,
    txHash
  );
  
  if (!results.checks.chain_anchor_valid) {
    results.errors.push('Chain anchor verification failed');
  }
  
  // 4. Verify signature (requires public key)
  // results.checks.signature_valid = await verifySignature(...);
  
  results.verified = 
    results.checks.event_hash_valid &&
    results.checks.merkle_proof_valid &&
    results.checks.chain_anchor_valid;
  
  return results;
}

interface IndependentVerificationResult {
  verified: boolean;
  checks: {
    event_hash_valid: boolean;
    merkle_proof_valid: boolean;
    chain_anchor_valid: boolean;
    signature_valid: boolean;
  };
  errors: string[];
}
```

---

### Story 4: CLI Verification Tool
**File:** `packages/cli/src/commands/verify.ts`

Create CLI command for verification.

```bash
# Verify a stamp by ID
memstamp verify stamp <stamp_id>

# Verify a Merkle root
memstamp verify root <merkle_root>

# Verify a content hash
memstamp verify hash <content_hash>

# Independent verification (no memstamp API)
memstamp verify independent \
  --stamp-file event.json \
  --proof-file proof.json \
  --chain solana \
  --tx-hash <tx_hash>
```

**Implementation:**
```typescript
import { Command } from 'commander';

const verify = new Command('verify')
  .description('Verify stamps and anchors');

verify
  .command('stamp <id>')
  .description('Verify a stamp by ID')
  .option('-a, --api-key <key>', 'API key')
  .action(async (id, options) => {
    const client = new MemstampClient({ apiKey: options.apiKey });
    const result = await client.verifyStamp(id);
    
    if (result.verified) {
      console.log('✓ Stamp verified');
      console.log(`  Chain: ${result.anchor?.chain}`);
      console.log(`  TX: ${result.anchor?.tx_hash}`);
    } else {
      console.log('✗ Verification failed');
      console.log(`  Error: ${result.error}`);
      process.exit(1);
    }
  });

verify
  .command('root <merkle_root>')
  .description('Verify a Merkle root')
  .action(async (root) => {
    // No auth needed for public verification
    const response = await fetch(`${API_URL}/v1/verify/${root}`);
    const result = await response.json();
    
    if (result.verified) {
      console.log('✓ Merkle root verified');
      console.log(`  Chain: ${result.anchor?.chain}`);
      console.log(`  Events: ${result.anchor?.event_count}`);
      console.log(`  Explorer: ${result.chain_proof?.explorer_url}`);
    } else {
      console.log('✗ Verification failed');
      process.exit(1);
    }
  });

verify
  .command('independent')
  .description('Verify independently without memstamp API')
  .requiredOption('--stamp-file <path>', 'Path to stamp JSON')
  .requiredOption('--proof-file <path>', 'Path to Merkle proof JSON')
  .requiredOption('--chain <chain>', 'Blockchain (solana, base, etc.)')
  .requiredOption('--tx-hash <hash>', 'Transaction hash')
  .option('--rpc <url>', 'Custom RPC URL')
  .action(async (options) => {
    const stamp = JSON.parse(fs.readFileSync(options.stampFile, 'utf8'));
    const proof = JSON.parse(fs.readFileSync(options.proofFile, 'utf8'));
    
    const result = await verifyStampIndependently(
      stamp,
      proof,
      options.rpc || getDefaultRpc(options.chain),
      options.txHash
    );
    
    console.log('Verification Results:');
    console.log(`  Event hash: ${result.checks.event_hash_valid ? '✓' : '✗'}`);
    console.log(`  Merkle proof: ${result.checks.merkle_proof_valid ? '✓' : '✗'}`);
    console.log(`  Chain anchor: ${result.checks.chain_anchor_valid ? '✓' : '✗'}`);
    console.log(`\n  Overall: ${result.verified ? '✓ VERIFIED' : '✗ FAILED'}`);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(e => console.log(`  - ${e}`));
    }
    
    process.exit(result.verified ? 0 : 1);
  });
```

---

### Story 5: API Documentation (OpenAPI)
**File:** `packages/api/src/docs/openapi.ts`

Complete OpenAPI documentation for all endpoints.

```typescript
export const openApiConfig = {
  openapi: {
    info: {
      title: 'memstamp API',
      description: 'Verifiable audit trails for AI agents',
      version: '0.1.0',
      contact: {
        name: 'Dharma Technologies',
        url: 'https://dharma.us',
        email: 'hello@dharma.us',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    externalDocs: {
      description: 'Full Documentation',
      url: 'https://memstamp.io/docs',
    },
    servers: [
      { url: 'https://api.memstamp.io', description: 'Production' },
      { url: 'http://localhost:8010', description: 'Local Development' },
    ],
    tags: [
      { name: 'stamps', description: 'Stamp management' },
      { name: 'agents', description: 'Agent audit trails' },
      { name: 'anchors', description: 'Blockchain anchors' },
      { name: 'verification', description: 'Public verification' },
      { name: 'account', description: 'Account management' },
    ],
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'API key in format: Bearer ms_live_xxx',
        },
      },
      schemas: {
        Stamp: { /* ... */ },
        Anchor: { /* ... */ },
        MerkleProof: { /* ... */ },
        VerificationResult: { /* ... */ },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            errors: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },
};
```

---

### Story 6: Getting Started Guide
**File:** `docs/getting-started.md`

Comprehensive getting started documentation.

```markdown
# Getting Started with memstamp

Get your first stamp verified in under 5 minutes.

## Installation

### TypeScript/Node.js

\`\`\`bash
npm install @memstamp/core
\`\`\`

### Python

\`\`\`bash
pip install memstamp
\`\`\`

## Quick Start

### 1. Get an API Key

Sign up at [memstamp.io](https://memstamp.io) to get your API key.

### 2. Create Your First Stamp

**TypeScript:**
\`\`\`typescript
import { MemstampClient } from '@memstamp/sdk';

const client = new MemstampClient({ apiKey: 'ms_live_xxx' });

const stamp = await client.stamp({
  agentId: 'my-agent-001',
  eventType: 'decision',
  content: {
    action: 'approved_loan',
    amount: 50000,
  },
});

console.log(\`Stamp created: \${stamp.id}\`);
console.log(\`Content hash: \${stamp.contentHash}\`);
\`\`\`

**Python:**
\`\`\`python
from memstamp import MemstampClient

client = MemstampClient(api_key="ms_live_xxx")

stamp = client.stamp(
    agent_id="my-agent-001",
    event_type="decision",
    content={"action": "approved_loan", "amount": 50000}
)

print(f"Stamp created: {stamp.id}")
print(f"Content hash: {stamp.content_hash}")
\`\`\`

### 3. Verify Your Stamp

\`\`\`python
result = client.verify(stamp.id)

if result.verified:
    print(f"✓ Verified on {result.chain}")
    print(f"  Transaction: {result.anchor_tx}")
else:
    print(f"✗ Not yet anchored (status: {stamp.status})")
\`\`\`

## How It Works

1. **Your agent** generates events (decisions, tool calls, etc.)
2. **memstamp client** hashes the content locally using SHA-256
3. **Only the hash** is sent to memstamp (raw content stays with you)
4. memstamp **batches hashes** into a Merkle tree
5. The **Merkle root** is anchored to blockchain
6. Anyone can **independently verify** stamps against the public chain

## Privacy Guarantee

Your raw content **never leaves your environment**. memstamp only receives:
- SHA-256 content hash
- Event metadata (type, agent ID, timestamp)

## Next Steps

- [API Reference](./api-reference.md)
- [Verification Guide](./verification.md)
- [LangChain Integration](./integrations/langchain.md)
- [VCOT Schema Spec](../schemas/README.md)
\`\`\`

---

### Story 7: API Reference Documentation
**File:** `docs/api-reference.md`

Complete API reference.

\`\`\`markdown
# API Reference

Base URL: `https://api.memstamp.io`

## Authentication

All authenticated endpoints require an API key:

\`\`\`
Authorization: Bearer ms_live_xxx
\`\`\`

## Endpoints

### Stamps

#### Create Stamp
\`POST /v1/stamps\`

Create a new stamp for an agent event.

**Request:**
\`\`\`json
{
  "agent_id": "my-agent-001",
  "event_type": "decision",
  "content_hash": "sha256:abc123...",
  "framework": "langchain/0.1",
  "signature": "ed25519:...",
  "metadata": {}
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "uuid",
  "event_id": "uuid",
  "content_hash": "sha256:abc123...",
  "status": "pending",
  "created_at": "2026-01-01T00:00:00Z"
}
\`\`\`

[... complete documentation for all endpoints ...]
\`\`\`

---

### Story 8: Verification Guide
**File:** `docs/verification.md`

Guide on verification for auditors.

\`\`\`markdown
# Verification Guide

How to verify memstamp audit trails — for auditors and compliance officers.

## Trust Model

memstamp is designed for **trustless verification**. You don't need to trust:
- memstamp (the company)
- The agent operator
- Anyone

You can independently verify everything using public blockchain data.

## Verification Methods

### 1. Using memstamp API (Convenient)

\`\`\`bash
curl https://api.memstamp.io/v1/verify/sha256:abc123...
\`\`\`

### 2. Independent Verification (Trustless)

No memstamp dependency required.

**Requirements:**
- The stamp data (JSON)
- The Merkle proof (JSON)
- Access to blockchain RPC

**Steps:**

1. **Verify the event hash**
   \`\`\`
   event_hash = SHA256(event_id | event_type | timestamp | agent_id | content_hash | previous_hash)
   \`\`\`

2. **Verify the Merkle proof**
   Walk the proof from leaf to root, verifying each hash computation.

3. **Verify the chain anchor**
   Read the transaction from the blockchain and confirm the Merkle root matches.

### Using the CLI

\`\`\`bash
memstamp verify independent \
  --stamp-file event.json \
  --proof-file proof.json \
  --chain solana \
  --tx-hash 5K7x...
\`\`\`

## What Verification Proves

| Check | What It Proves |
|-------|----------------|
| Event hash valid | Content hasn't been modified |
| Merkle proof valid | Event was part of the anchored batch |
| Chain anchor valid | Merkle root was anchored at specific time |
| Signature valid | Event came from legitimate agent framework |

## Chain Explorers

Verify transactions directly on blockchain explorers:

- **Solana:** [solscan.io](https://solscan.io)
- **Base:** [basescan.org](https://basescan.org)
- **Ethereum:** [etherscan.io](https://etherscan.io)
- **Bitcoin:** [blockstream.info](https://blockstream.info)
\`\`\`

---

### Story 9: README Updates
**File:** `README.md`

Update root README with complete information.

Include:
- Project overview
- Quick start
- Package descriptions
- Architecture diagram
- Supported chains
- Compliance mapping
- Contributing guide
- License

---

### Story 10: Integration Examples
**File:** `docs/examples/`

Create example code for common use cases.

**Files:**
- `examples/basic-usage.ts` — Simple stamp creation
- `examples/batch-stamps.ts` — Batch stamping
- `examples/verification.ts` — Verification flows
- `examples/langchain-agent.py` — LangChain integration
- `examples/mem0-memory.py` — mem0 integration
- `examples/audit-trail.ts` — Generating audit reports

---

### Story 11: VCOT Schema Documentation
**File:** `schemas/README.md`

Complete VCOT schema documentation.

Include:
- Schema overview
- Field definitions
- Event types explained
- Hash chain specification
- Signing specification
- Merkle tree specification
- Anchoring formats per chain
- Verification protocol
- Example events
- Schema evolution policy

---

### Story 12: Deployment Documentation
**File:** `docs/deployment.md`

Self-hosting documentation.

```markdown
# Self-Hosting memstamp

Run memstamp yourself if you want full control.

## Requirements

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Blockchain RPC endpoints

## Docker Compose (Recommended)

\`\`\`yaml
# docker-compose.production.yml
version: '3.8'

services:
  api:
    image: ghcr.io/dharma-technologies/memstamp-api:latest
    environment:
      DATABASE_URL: postgres://...
      REDIS_URL: redis://...
      HELIUS_API_KEY: ...
    ports:
      - "8010:8010"
  
  worker:
    image: ghcr.io/dharma-technologies/memstamp-worker:latest
    environment:
      DATABASE_URL: postgres://...
      REDIS_URL: redis://...
      SOLANA_PRIVATE_KEY: ...
  
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
\`\`\`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| REDIS_URL | Yes | Redis connection string |
| HELIUS_API_KEY | For Solana | Helius API key |
| SOLANA_PRIVATE_KEY | For Solana | Base58 encoded private key |
| ALCHEMY_API_KEY | For EVM | Alchemy API key |
| EVM_PRIVATE_KEY | For EVM | Hex private key |

## Wallet Setup

You need wallets with funds for chain anchoring:

### Solana
\`\`\`bash
solana-keygen new -o wallet.json
# Fund with SOL
\`\`\`

### EVM (Base, Ethereum, etc.)
\`\`\`bash
# Generate new wallet or use existing
# Fund with ETH
\`\`\`

## Running

\`\`\`bash
docker compose -f docker-compose.production.yml up -d
\`\`\`
```

---

## Completion Criteria

- [ ] All 12 stories implemented
- [ ] Public verification endpoint works
- [ ] Independent verification tool works
- [ ] CLI verification commands work
- [ ] OpenAPI docs complete
- [ ] Getting started guide complete
- [ ] API reference complete
- [ ] Verification guide complete
- [ ] README comprehensive
- [ ] Examples working
- [ ] VCOT schema documented
- [ ] Self-hosting docs complete
