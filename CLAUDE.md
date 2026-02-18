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

## Current Stage: P11-03-stamp-lifecycle

# P11-03: Stamp Lifecycle

**Phase 3 — Stamp CRUD & Status Management**

Implement stamp ingestion, storage, querying, and status tracking.

---

## Stories

### Story 1: Create Stamp Endpoint
**File:** `packages/api/src/routes/stamps.ts`

Implement `POST /v1/stamps` to create a single stamp.

**Request:**
```typescript
{
  agent_id: string;
  event_type: VCOTEventType;
  content_hash: string;      // sha256:xxx
  previous_hash?: string;    // Optional - auto-fetch if not provided
  framework: string;
  signature: string;
  metadata?: Record<string, unknown>;
}
```

**Response:**
```typescript
{
  id: string;
  event_id: string;
  agent_id: string;
  event_type: string;
  content_hash: string;
  previous_hash: string;
  status: 'pending';
  created_at: string;
}
```

**Logic:**
1. Validate request with Zod
2. If `previous_hash` not provided, fetch latest stamp for agent_id
3. Generate event_id (UUIDv7)
4. Insert stamp with status='pending'
5. Deduct 1 credit (based on chain)
6. Add to anchor queue
7. Return stamp

**Errors:**
- 400: Invalid request
- 401: Unauthorized
- 402: Insufficient credits

---

### Story 2: Batch Create Stamps Endpoint
**File:** `packages/api/src/routes/stamps.ts`

Implement `POST /v1/stamps/batch` for bulk stamp creation.

**Request:**
```typescript
{
  stamps: Array<CreateStampRequest>;  // Max 1000
}
```

**Response:**
```typescript
{
  created: number;
  stamps: Array<{
    id: string;
    event_id: string;
    content_hash: string;
    status: 'pending';
  }>;
  credits_used: number;
}
```

**Logic:**
1. Validate all stamps
2. Check total credit requirement
3. Insert all stamps in transaction
4. Deduct credits
5. Add batch to anchor queue
6. Return summary

**Optimizations:**
- Use batch insert
- Single credit transaction
- Group by agent_id for chain linking

---

### Story 3: Get Stamp Endpoint
**File:** `packages/api/src/routes/stamps.ts`

Implement `GET /v1/stamps/:id`.

**Response:**
```typescript
{
  id: string;
  event_id: string;
  agent_id: string;
  event_type: string;
  content_hash: string;
  previous_hash: string;
  framework: string;
  signature: string;
  status: 'pending' | 'anchored' | 'verified';
  anchor_id?: string;
  merkle_index?: number;
  created_at: string;
  anchored_at?: string;
}
```

**Logic:**
1. Fetch stamp by ID
2. Verify stamp belongs to account
3. Return stamp with anchor info if anchored

---

### Story 4: List Agent Stamps Endpoint
**File:** `packages/api/src/routes/stamps.ts`

Implement `GET /v1/agents/:agent_id/stamps`.

**Query params:**
- `limit` — Max results (default 50, max 100)
- `offset` — Pagination offset
- `status` — Filter by status
- `from` — Start timestamp
- `to` — End timestamp

**Response:**
```typescript
{
  stamps: Array<Stamp>;
  total: number;
  limit: number;
  offset: number;
}
```

**Logic:**
1. Verify account owns stamps for agent_id
2. Apply filters
3. Return paginated results
4. Include total count for pagination

---

### Story 5: Get Audit Trail Endpoint
**File:** `packages/api/src/routes/stamps.ts`

Implement `GET /v1/agents/:agent_id/trail`.

Returns stamps in order with hash chain validation status.

**Response:**
```typescript
{
  agent_id: string;
  stamps: Array<{
    id: string;
    event_id: string;
    content_hash: string;
    previous_hash: string;
    timestamp: string;
    chain_valid: boolean;  // Hash chain intact to this point
  }>;
  chain_integrity: 'valid' | 'broken' | 'incomplete';
  first_stamp: string;    // Timestamp
  last_stamp: string;     // Timestamp
  total_stamps: number;
}
```

**Logic:**
1. Fetch all stamps for agent in order
2. Validate hash chain
3. Flag any breaks
4. Return trail with integrity status

---

### Story 6: Gap Detection Endpoint
**File:** `packages/api/src/routes/stamps.ts`

Implement `GET /v1/agents/:agent_id/gaps`.

Detect time periods with no stamps (potential selective stamping).

**Query params:**
- `threshold_minutes` — Gap threshold (default 60)
- `from` — Start timestamp
- `to` — End timestamp

**Response:**
```typescript
{
  agent_id: string;
  gaps: Array<{
    start: string;
    end: string;
    duration_minutes: number;
  }>;
  gap_count: number;
  analyzed_period: {
    start: string;
    end: string;
  };
  average_stamp_interval_minutes: number;
}
```

**Logic:**
1. Fetch stamps in time range
2. Calculate intervals between stamps
3. Flag intervals exceeding threshold
4. Calculate statistics

---

### Story 7: Verify Stamp Endpoint (Authenticated)
**File:** `packages/api/src/routes/stamps.ts`

Implement `GET /v1/stamps/:id/verify`.

Full verification including chain lookup.

**Response:**
```typescript
{
  verified: boolean;
  stamp_id: string;
  content_hash: string;
  merkle_root?: string;
  merkle_proof?: MerkleProof;
  anchor?: {
    id: string;
    chain: string;
    tx_hash: string;
    block_number?: number;
    status: string;
  };
  chain_verified: boolean;
  signature_verified: boolean;
  hash_chain_valid: boolean;
  error?: string;
}
```

**Logic:**
1. Fetch stamp
2. Get anchor if anchored
3. Generate Merkle proof
4. Verify signature
5. Verify hash chain
6. Check chain (if anchored)
7. Return full verification result

---

### Story 8: Get Merkle Proof Endpoint
**File:** `packages/api/src/routes/stamps.ts`

Implement `GET /v1/stamps/:id/proof`.

**Response:**
```typescript
{
  stamp_id: string;
  leaf: string;
  proof: Array<{
    hash: string;
    position: 'left' | 'right';
  }>;
  root: string;
  anchor_id: string;
  chain: string;
  tx_hash?: string;
}
```

**Logic:**
1. Fetch stamp
2. Verify stamp is anchored
3. Fetch all stamps in same anchor batch
4. Generate Merkle proof
5. Return proof with anchor info

---

### Story 9: Stamp Service Layer
**File:** `packages/api/src/services/stamps.ts`

Create service layer for stamp operations.

**Functions:**
```typescript
export class StampService {
  // Create single stamp
  async create(accountId: string, input: CreateStampInput): Promise<Stamp>
  
  // Create batch of stamps
  async createBatch(accountId: string, stamps: CreateStampInput[]): Promise<Stamp[]>
  
  // Get stamp by ID
  async getById(id: string, accountId: string): Promise<Stamp | null>
  
  // List stamps for agent
  async listByAgent(
    agentId: string,
    accountId: string,
    options: ListOptions
  ): Promise<{ stamps: Stamp[]; total: number }>
  
  // Get audit trail
  async getAuditTrail(agentId: string, accountId: string): Promise<AuditTrail>
  
  // Detect gaps
  async detectGaps(
    agentId: string,
    accountId: string,
    thresholdMinutes: number
  ): Promise<GapReport>
  
  // Get latest stamp for agent (for chaining)
  async getLatestForAgent(agentId: string, accountId: string): Promise<Stamp | null>
  
  // Update stamp status
  async updateStatus(
    stampIds: string[],
    status: StampStatus,
    anchorId?: string
  ): Promise<void>
}
```

---

### Story 10: Hash Chain Validation Service
**File:** `packages/api/src/services/chain-validation.ts`

Service for validating hash chains.

**Functions:**
```typescript
export class ChainValidationService {
  // Validate entire chain for an agent
  async validateChain(
    agentId: string,
    accountId: string
  ): Promise<ChainValidationResult>
  
  // Validate signature on a stamp
  async validateSignature(
    stamp: Stamp,
    publicKey: string
  ): Promise<boolean>
  
  // Find chain breaks
  async findChainBreaks(
    stamps: Stamp[]
  ): Promise<ChainBreak[]>
}

interface ChainValidationResult {
  valid: boolean;
  total_stamps: number;
  breaks: ChainBreak[];
  first_break_at?: string;
}

interface ChainBreak {
  stamp_id: string;
  expected_previous: string;
  actual_previous: string;
  position: number;
}
```

---

### Story 11: Anchor Queue Integration
**File:** `packages/api/src/services/queue.ts`

Set up BullMQ queue for anchor jobs.

**Queues:**
```typescript
import { Queue } from 'bullmq';
import { redis } from './redis';

export const anchorQueue = new Queue('anchor', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

// Add stamp to anchor queue
export async function queueForAnchoring(stampIds: string[]): Promise<void> {
  await anchorQueue.add('anchor-batch', { stampIds }, {
    delay: config.anchorTimeWindowMs,  // Wait for batch window
  });
}

// Add immediate anchor job (for single high-priority stamps)
export async function queueImmediateAnchor(stampId: string): Promise<void> {
  await anchorQueue.add('anchor-immediate', { stampId }, {
    priority: 1,
  });
}
```

---

### Story 12: Stamp Status Transitions
**File:** `packages/api/src/services/stamps.ts`

Implement status transition logic.

**States:**
1. `pending` — Created, waiting for anchoring
2. `anchored` — Included in Merkle tree, submitted to chain
3. `verified` — Chain transaction confirmed/finalized

**Transitions:**
- `pending` → `anchored` (when batch submitted)
- `anchored` → `verified` (when chain confirms)
- No backward transitions

**Update function:**
```typescript
async function transitionStatus(
  stampId: string,
  from: StampStatus,
  to: StampStatus,
  anchorId?: string
): Promise<boolean> {
  const result = await db.update(stamps)
    .set({ 
      status: to, 
      anchorId,
      ...(to === 'anchored' ? { anchoredAt: new Date() } : {})
    })
    .where(
      and(
        eq(stamps.id, stampId),
        eq(stamps.status, from)
      )
    )
    .returning();
  
  return result.length > 0;
}
```

---

### Story 13: Stamp Repository
**File:** `packages/api/src/repositories/stamps.ts`

Database access layer for stamps.

```typescript
export class StampRepository {
  // Insert stamp
  async insert(data: NewStamp): Promise<Stamp>
  
  // Insert batch
  async insertBatch(data: NewStamp[]): Promise<Stamp[]>
  
  // Find by ID
  async findById(id: string): Promise<Stamp | null>
  
  // Find by event ID
  async findByEventId(eventId: string): Promise<Stamp | null>
  
  // Find by account
  async findByAccount(
    accountId: string,
    options: QueryOptions
  ): Promise<Stamp[]>
  
  // Find by agent
  async findByAgent(
    agentId: string,
    accountId: string,
    options: QueryOptions
  ): Promise<Stamp[]>
  
  // Find pending stamps for anchoring
  async findPendingForAnchoring(
    chain: string,
    limit: number
  ): Promise<Stamp[]>
  
  // Update status
  async updateStatus(
    ids: string[],
    status: StampStatus,
    anchorId?: string
  ): Promise<number>
  
  // Count by agent
  async countByAgent(
    agentId: string,
    accountId: string
  ): Promise<number>
}
```

---

### Story 14: Tests for Stamp Endpoints
**File:** `packages/api/tests/stamps.test.ts`

Integration tests for stamp endpoints.

**Test scenarios:**
1. Create stamp successfully
2. Create stamp without credits fails
3. Batch create stamps
4. Get stamp by ID
5. Get stamp not owned returns 404
6. List stamps with pagination
7. List stamps with filters
8. Get audit trail
9. Gap detection
10. Verify stamp

**Test setup:**
- Create test account with API key
- Create test stamps
- Mock Redis/queue

---

## Completion Criteria

- [ ] All 14 stories implemented
- [ ] All endpoints tested
- [ ] Status transitions correct
- [ ] Hash chain validation works
- [ ] Gap detection works
- [ ] Queue integration working
- [ ] Pagination working
- [ ] Error handling correct
