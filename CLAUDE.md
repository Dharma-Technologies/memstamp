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

## Current Stage: P11-01-core-schema

# P11-01: Core Schema & Library

**Phase 1 — Foundation**

Build the core @memstamp/core library: VCOT schema, hashing, Merkle trees, and Ed25519 signing. This is the protocol foundation — every line of code matters.

---

## Stories

### Story 1: VCOT TypeScript Types
**File:** `packages/core/src/types.ts`

Define all TypeScript types for the VCOT schema.

**Types to define:**
```typescript
export const VCOT_VERSION = 'vcot/0.1' as const;

export type VCOTEventType =
  | 'decision'
  | 'tool_call'
  | 'tool_result'
  | 'memory_write'
  | 'memory_read'
  | 'external_action'
  | 'state_change'
  | 'observation'
  | 'custom';

export interface VCOTEvent {
  version: typeof VCOT_VERSION;
  event_id: string;
  event_type: VCOTEventType;
  timestamp: string;
  agent_id: string;
  content_hash: string;
  previous_hash: string;
  framework: string;
  signature: string;
  metadata?: Record<string, unknown>;
}

export interface VCOTEventInput {
  event_type: VCOTEventType;
  agent_id: string;
  content: unknown;
  framework?: string;
  metadata?: Record<string, unknown>;
}

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
}

export interface MerkleProof {
  leaf: string;
  proof: Array<{
    hash: string;
    position: 'left' | 'right';
  }>;
  root: string;
}

export interface AnchorRecord {
  id: string;
  merkle_root: string;
  event_count: number;
  time_range: {
    start: string;
    end: string;
  };
  chain: string;
  tx_hash: string;
  block_number?: number;
  status: 'pending' | 'confirmed' | 'finalized';
  created_at: string;
}

export interface VerificationResult {
  verified: boolean;
  event_id: string;
  content_hash: string;
  merkle_root: string;
  anchor?: AnchorRecord;
  chain_verified: boolean;
  signature_verified: boolean;
  hash_chain_valid: boolean;
  error?: string;
}
```

---

### Story 2: JSON Schema Definition
**File:** `schemas/vcot-v1.json`

Create the JSON Schema for VCOT v0.1 events.

**Schema requirements:**
- `$schema`: "http://json-schema.org/draft-07/schema#"
- `$id`: "https://memstamp.io/schemas/vcot-v1.json"
- All required fields with correct types
- `content_hash` pattern: `^sha256:[a-f0-9]{64}$`
- `previous_hash` pattern: `^sha256:[a-f0-9]{64}$`
- `timestamp` format: date-time
- `event_type` enum with all 9 types
- `additionalProperties`: false

---

### Story 3: Canonical JSON Serialization
**File:** `packages/core/src/hash.ts`

Implement canonical JSON serialization for deterministic hashing.

**Requirements:**
- Sort object keys alphabetically (recursive)
- No whitespace
- UTF-8 encoding
- Handle nested objects
- Preserve array order (don't sort arrays)
- Handle null, boolean, number, string correctly

**Function:**
```typescript
export function canonicalJson(obj: unknown): string
```

**Test cases:**
- `{b: 1, a: 2}` → `{"a":2,"b":1}`
- `{b: {z: 1, a: 2}, a: 1}` → `{"a":1,"b":{"a":2,"z":1}}`
- `{arr: [3, 1, 2]}` → `{"arr":[3,1,2]}` (array order preserved)

---

### Story 4: SHA-256 Hash Computation
**File:** `packages/core/src/hash.ts`

Implement content hashing with SHA-256.

**Functions:**
```typescript
// Compute content hash
export function computeHash(content: unknown): string
// Returns: "sha256:<64-char-hex>"

// Compute event hash for chaining
export function computeEventHash(
  eventId: string,
  eventType: string,
  timestamp: string,
  agentId: string,
  contentHash: string,
  previousHash: string
): string
// Hash of: event_id|event_type|timestamp|agent_id|content_hash|previous_hash

// Genesis hash constant
export const GENESIS_HASH = 'sha256:' + '0'.repeat(64);
```

**Implementation:**
- Use Node.js `crypto.createHash('sha256')`
- Content hash: SHA-256 of canonical JSON
- Event hash: SHA-256 of pipe-delimited fields

**Tests:**
- Same content → same hash
- Different key order → same hash
- Different content → different hash
- Genesis hash is 64 zeros with sha256: prefix

---

### Story 5: Merkle Tree Construction
**File:** `packages/core/src/merkle.ts`

Implement Merkle tree building from leaf hashes.

**Functions:**
```typescript
// Build full tree from leaves
export function buildMerkleTree(leaves: string[]): MerkleNode | null

// Just compute root (more efficient if full tree not needed)
export function computeMerkleRoot(leaves: string[]): string
```

**Algorithm:**
1. Create leaf nodes from input hashes
2. If odd number, duplicate last leaf
3. Combine pairs: `hash(left + right)` where + is hex concatenation
4. Repeat until single root

**Edge cases:**
- Empty array → null/empty string
- Single leaf → that leaf is the root
- Two leaves → one level
- Odd number → duplicate last leaf

**Tests:**
- Empty array
- Single element
- Two elements
- Odd number of elements
- Power of 2 elements
- Large array (1000+ elements)

---

### Story 6: Merkle Proof Generation
**File:** `packages/core/src/merkle.ts`

Implement Merkle proof generation for individual leaves.

**Function:**
```typescript
export function generateMerkleProof(
  leaves: string[],
  leafIndex: number
): MerkleProof | null
```

**Proof structure:**
```typescript
{
  leaf: "sha256:xxx",           // The leaf being proved
  proof: [
    { hash: "sha256:xxx", position: "right" },  // Sibling at level 0
    { hash: "sha256:xxx", position: "left" },   // Sibling at level 1
    // ... up to root
  ],
  root: "sha256:xxx"            // The merkle root
}
```

**Tests:**
- Generate proof for first, middle, last leaf
- Proof for single-element tree
- Proof for odd-numbered tree
- Invalid index returns null

---

### Story 7: Merkle Proof Verification
**File:** `packages/core/src/merkle.ts`

Implement Merkle proof verification.

**Function:**
```typescript
export function verifyMerkleProof(proof: MerkleProof): boolean
```

**Algorithm:**
1. Start with leaf hash
2. For each step in proof:
   - If position is 'left', hash = SHA256(step.hash + current)
   - If position is 'right', hash = SHA256(current + step.hash)
3. Final hash should equal proof.root

**Tests:**
- Valid proof verifies true
- Tampered leaf verifies false
- Tampered proof step verifies false
- Tampered root verifies false
- Wrong position verifies false

---

### Story 8: Ed25519 Key Generation
**File:** `packages/core/src/signing.ts`

Implement Ed25519 key pair generation.

**Dependency:** `@noble/ed25519`

**Function:**
```typescript
export async function generateKeyPair(): Promise<{
  publicKey: string;   // hex-encoded
  privateKey: string;  // hex-encoded
}>
```

**Tests:**
- Generated keys are correct length
- Different calls generate different keys
- Keys can be used for signing/verification

---

### Story 9: Ed25519 Signing
**File:** `packages/core/src/signing.ts`

Implement event hash signing.

**Function:**
```typescript
export async function signEventHash(
  eventHash: string,    // sha256:xxx
  privateKey: string    // hex-encoded
): Promise<string>      // signature, hex-encoded
```

**Implementation:**
- Strip "sha256:" prefix from event hash
- Convert hash hex to bytes
- Sign with @noble/ed25519
- Return hex-encoded signature

**Tests:**
- Signing produces consistent output for same inputs
- Signature is correct length (128 hex chars = 64 bytes)

---

### Story 10: Ed25519 Verification
**File:** `packages/core/src/signing.ts`

Implement signature verification.

**Function:**
```typescript
export async function verifySignature(
  eventHash: string,    // sha256:xxx
  signature: string,    // hex-encoded
  publicKey: string     // hex-encoded
): Promise<boolean>
```

**Tests:**
- Valid signature verifies true
- Wrong hash verifies false
- Wrong signature verifies false
- Wrong public key verifies false
- Malformed inputs return false (not throw)

---

### Story 11: VCOT Event Validation
**File:** `packages/core/src/validation.ts`

Implement VCOT event validation using JSON Schema.

**Dependency:** `ajv`, `ajv-formats`

**Functions:**
```typescript
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export function validateVCOTEvent(event: unknown): ValidationResult

export function validateHashChain(
  events: VCOTEvent[],
  genesisHash: string
): ValidationResult
```

**validateVCOTEvent:**
- Load vcot-v1.json schema
- Validate event against schema
- Return errors if invalid

**validateHashChain:**
- First event must reference genesis hash
- Each subsequent event must reference previous event's hash
- Return which link is broken if invalid

**Tests:**
- Valid event passes
- Missing required field fails
- Invalid hash format fails
- Invalid event_type fails
- Valid chain passes
- Broken chain link detected
- Empty chain is valid

---

### Story 12: VCOT Event Creation Helper
**File:** `packages/core/src/event.ts`

Implement helper function to create valid VCOT events.

**Function:**
```typescript
export async function createVCOTEvent(
  input: VCOTEventInput,
  previousHash: string,
  privateKey: string
): Promise<VCOTEvent>
```

**Implementation:**
1. Generate UUIDv7 for event_id
2. Get current ISO 8601 timestamp
3. Compute content_hash from input.content
4. Compute event_hash from all fields
5. Sign event_hash with private key
6. Return complete VCOTEvent

**Dependencies:**
- Add `uuidv7` package or implement UUIDv7

**Tests:**
- Creates valid event that passes validation
- Events chain correctly
- Timestamps are valid ISO 8601
- Content hash is deterministic

---

### Story 13: Package Build & Exports
**Files:** 
- `packages/core/src/index.ts`
- `packages/core/package.json`
- `packages/core/tsconfig.json`

Set up proper exports and build configuration.

**index.ts exports:**
```typescript
// Types
export * from './types';

// Schema
export { VCOT_SCHEMA_V1 } from './schema';

// Hashing
export { computeHash, computeEventHash, canonicalJson, GENESIS_HASH } from './hash';

// Merkle
export { buildMerkleTree, computeMerkleRoot, generateMerkleProof, verifyMerkleProof } from './merkle';

// Signing
export { generateKeyPair, signEventHash, verifySignature } from './signing';

// Validation
export { validateVCOTEvent, validateHashChain } from './validation';

// Event creation
export { createVCOTEvent } from './event';
```

**package.json:**
- Build with tsup
- Export CJS and ESM
- Export types
- Specify peer dependencies

**Build verification:**
```bash
cd packages/core
pnpm build
# Verify dist/index.js, dist/index.mjs, dist/index.d.ts exist
```

---

### Story 14: Comprehensive Test Suite
**File:** `packages/core/tests/`

Create comprehensive tests for all core functionality.

**Test files:**
- `hash.test.ts` — canonical JSON, SHA-256
- `merkle.test.ts` — tree building, proofs, verification
- `signing.test.ts` — key generation, signing, verification
- `validation.test.ts` — schema validation, chain validation
- `event.test.ts` — event creation, chaining
- `integration.test.ts` — end-to-end workflows

**integration.test.ts scenarios:**
1. Create chain of 10 events
2. Build Merkle tree from chain
3. Generate and verify proofs
4. Verify all signatures
5. Validate hash chain integrity

**Run tests:**
```bash
cd packages/core
pnpm test
```

---

## Completion Criteria

- [ ] All 14 stories implemented
- [ ] All tests pass
- [ ] TypeScript strict mode, zero errors
- [ ] Package builds successfully
- [ ] No external dependencies for core hashing (crypto is Node built-in)
- [ ] Total core library < 1,000 LoC (excluding tests)
