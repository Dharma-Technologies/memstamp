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

## Current Stage: P11-04-chain-anchoring

# P11-04: Chain Anchoring

**Phase 4 — Blockchain Integration**

Build the worker for background anchoring and implement chain adapters for Solana, EVM, and Bitcoin.

---

## Stories

### Story 1: Worker Setup
**File:** `packages/worker/src/index.ts`

Set up BullMQ worker to process anchor jobs.

**Worker configuration:**
```typescript
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

const worker = new Worker('anchor', async (job: Job) => {
  switch (job.name) {
    case 'anchor-batch':
      return await processBatchAnchor(job.data);
    case 'anchor-immediate':
      return await processImmediateAnchor(job.data);
    case 'verify-confirmation':
      return await processConfirmationCheck(job.data);
    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
}, {
  connection,
  concurrency: 5,
});

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});
```

---

### Story 2: Batch Anchor Processor
**File:** `packages/worker/src/processors/batch.ts`

Process batch anchor jobs.

**Logic:**
1. Fetch all pending stamps for the batch
2. Group by chain preference
3. Build Merkle tree from content hashes
4. Create anchor record
5. Submit to chain
6. Update stamp statuses
7. Queue confirmation check

```typescript
async function processBatchAnchor(data: { stampIds?: string[] }): Promise<AnchorResult> {
  // Get pending stamps (either specific IDs or by time window)
  const stamps = data.stampIds 
    ? await stampRepo.findByIds(data.stampIds)
    : await stampRepo.findPendingForAnchoring(config.defaultChain, config.anchorBatchSize);
  
  if (stamps.length === 0) {
    return { skipped: true, reason: 'No pending stamps' };
  }
  
  // Build Merkle tree
  const leaves = stamps.map(s => s.contentHash);
  const merkleRoot = computeMerkleRoot(leaves);
  
  // Create anchor record
  const anchor = await anchorRepo.insert({
    merkleRoot,
    eventCount: stamps.length,
    startTime: stamps[0].createdAt,
    endTime: stamps[stamps.length - 1].createdAt,
    chain: config.defaultChain,
    status: 'pending',
  });
  
  // Submit to chain
  const chainAdapter = getChainAdapter(config.defaultChain);
  const txHash = await chainAdapter.anchor(merkleRoot, stamps.length);
  
  // Update anchor with tx hash
  await anchorRepo.update(anchor.id, { txHash });
  
  // Update stamps
  await stampRepo.updateStatus(stamps.map(s => s.id), 'anchored', anchor.id);
  
  // Queue confirmation check
  await confirmationQueue.add('check-confirmation', {
    anchorId: anchor.id,
    chain: config.defaultChain,
    txHash,
  }, { delay: 30000 }); // Check after 30 seconds
  
  return {
    anchorId: anchor.id,
    merkleRoot,
    stampCount: stamps.length,
    txHash,
  };
}
```

---

### Story 3: Chain Adapter Interface
**File:** `packages/worker/src/chains/types.ts`

Define the chain adapter interface.

```typescript
export interface ChainAdapter {
  // Chain identifier
  readonly chain: string;
  
  // Anchor a Merkle root
  anchor(merkleRoot: string, eventCount: number): Promise<string>; // Returns tx hash
  
  // Check transaction status
  getTransactionStatus(txHash: string): Promise<TransactionStatus>;
  
  // Get transaction details
  getTransactionDetails(txHash: string): Promise<TransactionDetails>;
  
  // Verify a Merkle root is anchored
  verifyAnchor(merkleRoot: string, txHash: string): Promise<boolean>;
  
  // Get current credit cost per stamp
  getCreditCost(): Promise<number>;
}

export interface TransactionStatus {
  confirmed: boolean;
  finalized: boolean;
  blockNumber?: number;
  confirmations?: number;
  error?: string;
}

export interface TransactionDetails {
  txHash: string;
  blockNumber: number;
  timestamp: string;
  merkleRoot: string;
  eventCount: number;
}

export function getChainAdapter(chain: string): ChainAdapter {
  switch (chain) {
    case 'solana':
      return new SolanaAdapter();
    case 'base':
    case 'ethereum':
    case 'arbitrum':
      return new EVMAdapter(chain);
    case 'bitcoin':
      return new BitcoinAdapter();
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}
```

---

### Story 4: Solana Adapter
**File:** `packages/worker/src/chains/solana.ts`

Implement Solana anchoring via memo program.

**Memo format:** `vcot:v0.1:<merkle_root>:<event_count>:<timestamp>`

```typescript
import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createMemoInstruction } from '@solana/spl-memo';

export class SolanaAdapter implements ChainAdapter {
  readonly chain = 'solana';
  private connection: Connection;
  private keypair: Keypair;
  
  constructor() {
    this.connection = new Connection(config.solanaRpcUrl);
    this.keypair = Keypair.fromSecretKey(
      bs58.decode(config.solanaPrivateKey)
    );
  }
  
  async anchor(merkleRoot: string, eventCount: number): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000);
    const memo = `vcot:v0.1:${merkleRoot}:${eventCount}:${timestamp}`;
    
    const transaction = new Transaction().add(
      createMemoInstruction(memo)
    );
    
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.keypair],
      { commitment: 'confirmed' }
    );
    
    return signature;
  }
  
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    const status = await this.connection.getSignatureStatus(txHash);
    
    return {
      confirmed: status?.value?.confirmationStatus === 'confirmed' || 
                 status?.value?.confirmationStatus === 'finalized',
      finalized: status?.value?.confirmationStatus === 'finalized',
      confirmations: status?.value?.confirmations ?? 0,
      error: status?.value?.err?.toString(),
    };
  }
  
  async getTransactionDetails(txHash: string): Promise<TransactionDetails> {
    const tx = await this.connection.getTransaction(txHash, {
      commitment: 'finalized',
    });
    
    if (!tx) {
      throw new Error('Transaction not found');
    }
    
    // Parse memo from transaction
    const memoInstruction = tx.transaction.message.instructions.find(
      ix => ix.programId.toString() === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
    );
    
    const memoData = memoInstruction?.data;
    const memo = Buffer.from(memoData as Buffer).toString('utf8');
    const [, , merkleRoot, eventCount, timestamp] = memo.split(':');
    
    return {
      txHash,
      blockNumber: tx.slot,
      timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
      merkleRoot,
      eventCount: parseInt(eventCount),
    };
  }
  
  async verifyAnchor(merkleRoot: string, txHash: string): Promise<boolean> {
    try {
      const details = await this.getTransactionDetails(txHash);
      return details.merkleRoot === merkleRoot;
    } catch {
      return false;
    }
  }
  
  async getCreditCost(): Promise<number> {
    // Solana = 1 credit per stamp
    return 1;
  }
}
```

---

### Story 5: EVM Adapter (EAS)
**File:** `packages/worker/src/chains/evm.ts`

Implement EVM anchoring via Ethereum Attestation Service.

```typescript
import { ethers } from 'ethers';
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';

const EAS_ADDRESSES: Record<string, string> = {
  base: '0x4200000000000000000000000000000000000021',
  ethereum: '0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587',
  arbitrum: '0xbD75f629A22Dc480D9470a94506ED',
};

const VCOT_SCHEMA_UID = '0x...'; // Will be registered

export class EVMAdapter implements ChainAdapter {
  readonly chain: string;
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private eas: EAS;
  
  constructor(chain: string) {
    this.chain = chain;
    this.provider = new ethers.JsonRpcProvider(this.getRpcUrl(chain));
    this.wallet = new ethers.Wallet(config.evmPrivateKey, this.provider);
    this.eas = new EAS(EAS_ADDRESSES[chain]);
    this.eas.connect(this.wallet);
  }
  
  private getRpcUrl(chain: string): string {
    switch (chain) {
      case 'base': return config.baseRpcUrl;
      case 'ethereum': return `https://eth-mainnet.g.alchemy.com/v2/${config.alchemyApiKey}`;
      case 'arbitrum': return `https://arb-mainnet.g.alchemy.com/v2/${config.alchemyApiKey}`;
      default: throw new Error(`Unknown EVM chain: ${chain}`);
    }
  }
  
  async anchor(merkleRoot: string, eventCount: number): Promise<string> {
    const schemaEncoder = new SchemaEncoder(
      'bytes32 merkleRoot,uint256 eventCount,uint256 timestamp'
    );
    
    const encodedData = schemaEncoder.encodeData([
      { name: 'merkleRoot', type: 'bytes32', value: merkleRoot },
      { name: 'eventCount', type: 'uint256', value: eventCount },
      { name: 'timestamp', type: 'uint256', value: Math.floor(Date.now() / 1000) },
    ]);
    
    const tx = await this.eas.attest({
      schema: VCOT_SCHEMA_UID,
      data: {
        recipient: ethers.ZeroAddress,
        expirationTime: 0n,
        revocable: false,
        data: encodedData,
      },
    });
    
    const receipt = await tx.wait();
    return receipt.hash;
  }
  
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    const receipt = await this.provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return { confirmed: false, finalized: false };
    }
    
    const currentBlock = await this.provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;
    
    return {
      confirmed: confirmations >= 1,
      finalized: confirmations >= 12, // EVM finality varies by chain
      blockNumber: receipt.blockNumber,
      confirmations,
    };
  }
  
  async verifyAnchor(merkleRoot: string, txHash: string): Promise<boolean> {
    // Verify attestation exists and contains correct merkle root
    try {
      const tx = await this.provider.getTransaction(txHash);
      // Parse attestation data...
      return true; // Simplified
    } catch {
      return false;
    }
  }
  
  async getCreditCost(): Promise<number> {
    switch (this.chain) {
      case 'base': return 2;
      case 'arbitrum': return 3;
      case 'ethereum': return 20;
      default: return 5;
    }
  }
}
```

---

### Story 6: Bitcoin Adapter
**File:** `packages/worker/src/chains/bitcoin.ts`

Implement Bitcoin anchoring via OP_RETURN.

**OP_RETURN format:** `VCOT` + 32-byte merkle root (36 bytes total)

```typescript
import * as bitcoin from 'bitcoinjs-lib';

export class BitcoinAdapter implements ChainAdapter {
  readonly chain = 'bitcoin';
  private network: bitcoin.Network;
  
  constructor() {
    this.network = config.nodeEnv === 'production' 
      ? bitcoin.networks.bitcoin 
      : bitcoin.networks.testnet;
  }
  
  async anchor(merkleRoot: string, eventCount: number): Promise<string> {
    // Build OP_RETURN transaction
    const prefix = Buffer.from('VCOT');
    const rootBytes = Buffer.from(merkleRoot.replace('sha256:', ''), 'hex');
    const data = Buffer.concat([prefix, rootBytes]);
    
    const embed = bitcoin.payments.embed({ data: [data] });
    
    // Build and sign transaction
    // ... (requires UTXO management, signing, broadcasting)
    
    throw new Error('Bitcoin adapter not fully implemented');
  }
  
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    // Query Bitcoin node/API for transaction status
    throw new Error('Bitcoin adapter not fully implemented');
  }
  
  async verifyAnchor(merkleRoot: string, txHash: string): Promise<boolean> {
    throw new Error('Bitcoin adapter not fully implemented');
  }
  
  async getCreditCost(): Promise<number> {
    return 50; // Bitcoin is most expensive
  }
}
```

**Note:** Bitcoin adapter is more complex due to UTXO management. Mark as TODO for full implementation.

---

### Story 7: Confirmation Checker
**File:** `packages/worker/src/processors/confirmation.ts`

Process confirmation check jobs.

```typescript
async function processConfirmationCheck(data: {
  anchorId: string;
  chain: string;
  txHash: string;
}): Promise<void> {
  const adapter = getChainAdapter(data.chain);
  const status = await adapter.getTransactionStatus(data.txHash);
  
  if (status.error) {
    // Transaction failed - need to retry anchoring
    await anchorRepo.update(data.anchorId, {
      status: 'failed',
      error: status.error,
    });
    return;
  }
  
  if (status.finalized) {
    // Update anchor to finalized
    await anchorRepo.update(data.anchorId, {
      status: 'finalized',
      blockNumber: status.blockNumber,
    });
    
    // Update all stamps to verified
    const anchor = await anchorRepo.findById(data.anchorId);
    await stampRepo.updateStatusByAnchor(data.anchorId, 'verified');
    
    return;
  }
  
  if (status.confirmed) {
    // Update anchor to confirmed
    await anchorRepo.update(data.anchorId, {
      status: 'confirmed',
      blockNumber: status.blockNumber,
    });
  }
  
  // Not yet finalized - requeue check
  const delay = status.confirmed ? 60000 : 30000; // 1 min if confirmed, 30s if not
  await confirmationQueue.add('check-confirmation', data, { delay });
}
```

---

### Story 8: Merkle Batching Service
**File:** `packages/worker/src/services/batching.ts`

Service for managing batch windows.

```typescript
export class BatchingService {
  private pendingBatch: Map<string, string[]> = new Map(); // chain -> stampIds
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  
  async addToBatch(stampId: string, chain: string): Promise<void> {
    if (!this.pendingBatch.has(chain)) {
      this.pendingBatch.set(chain, []);
    }
    
    this.pendingBatch.get(chain)!.push(stampId);
    
    // Start timer if first item
    if (this.pendingBatch.get(chain)!.length === 1) {
      this.startBatchTimer(chain);
    }
    
    // Flush if batch size reached
    if (this.pendingBatch.get(chain)!.length >= config.anchorBatchSize) {
      await this.flushBatch(chain);
    }
  }
  
  private startBatchTimer(chain: string): void {
    const timer = setTimeout(async () => {
      await this.flushBatch(chain);
    }, config.anchorTimeWindowMs);
    
    this.batchTimers.set(chain, timer);
  }
  
  async flushBatch(chain: string): Promise<void> {
    const stampIds = this.pendingBatch.get(chain) ?? [];
    if (stampIds.length === 0) return;
    
    // Clear pending
    this.pendingBatch.set(chain, []);
    
    // Clear timer
    const timer = this.batchTimers.get(chain);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(chain);
    }
    
    // Queue anchor job
    await anchorQueue.add('anchor-batch', {
      stampIds,
      chain,
    });
  }
}
```

---

### Story 9: Anchor Repository
**File:** `packages/worker/src/repositories/anchors.ts`

Database access for anchors.

```typescript
export class AnchorRepository {
  async insert(data: NewAnchor): Promise<Anchor> {
    const [anchor] = await db.insert(anchors).values(data).returning();
    return anchor;
  }
  
  async findById(id: string): Promise<Anchor | null> {
    return await db.query.anchors.findFirst({
      where: eq(anchors.id, id),
    });
  }
  
  async findByMerkleRoot(root: string): Promise<Anchor | null> {
    return await db.query.anchors.findFirst({
      where: eq(anchors.merkleRoot, root),
    });
  }
  
  async update(id: string, data: Partial<Anchor>): Promise<void> {
    await db.update(anchors).set(data).where(eq(anchors.id, id));
  }
  
  async findPending(): Promise<Anchor[]> {
    return await db.query.anchors.findMany({
      where: eq(anchors.status, 'pending'),
    });
  }
  
  async findByChain(chain: string, options: QueryOptions): Promise<Anchor[]> {
    return await db.query.anchors.findMany({
      where: eq(anchors.chain, chain),
      limit: options.limit,
      offset: options.offset,
      orderBy: desc(anchors.createdAt),
    });
  }
}
```

---

### Story 10: Worker Docker Setup
**File:** `packages/worker/Dockerfile`

Docker setup for worker.

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/worker/package.json ./packages/worker/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/worker/node_modules ./packages/worker/node_modules
COPY . .
RUN pnpm turbo build --filter=@memstamp/worker

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 memstamp
COPY --from=builder --chown=memstamp:nodejs /app/packages/worker/dist ./dist
COPY --from=builder --chown=memstamp:nodejs /app/packages/worker/package.json ./
USER memstamp
CMD ["node", "dist/index.js"]
```

---

### Story 11: Chain Costs Endpoint
**File:** `packages/api/src/routes/public.ts`

Implement `GET /v1/chains` endpoint.

**Response:**
```typescript
{
  chains: Array<{
    id: string;
    name: string;
    credits_per_stamp: number;
    status: 'active' | 'maintenance' | 'deprecated';
    avg_finality_seconds: number;
  }>;
  default_chain: string;
}
```

**Implementation:**
```typescript
app.get('/v1/chains', async () => {
  return {
    chains: [
      {
        id: 'solana',
        name: 'Solana',
        credits_per_stamp: 1,
        status: 'active',
        avg_finality_seconds: 0.4,
      },
      {
        id: 'base',
        name: 'Base',
        credits_per_stamp: 2,
        status: 'active',
        avg_finality_seconds: 2,
      },
      {
        id: 'bitcoin',
        name: 'Bitcoin',
        credits_per_stamp: 50,
        status: 'active',
        avg_finality_seconds: 600,
      },
    ],
    default_chain: config.defaultChain,
  };
});
```

---

### Story 12: Worker Health & Metrics
**File:** `packages/worker/src/health.ts`

Add health check and metrics endpoint for worker.

```typescript
import Fastify from 'fastify';

const healthServer = Fastify();

healthServer.get('/health', async () => {
  // Check Redis connection
  const redisOk = await redis.ping() === 'PONG';
  
  // Check queue stats
  const waiting = await anchorQueue.getWaitingCount();
  const active = await anchorQueue.getActiveCount();
  
  return {
    status: redisOk ? 'ok' : 'degraded',
    redis: redisOk ? 'ok' : 'error',
    queue: {
      waiting,
      active,
    },
    timestamp: new Date().toISOString(),
  };
});

healthServer.get('/metrics', async () => {
  const completed = await anchorQueue.getCompletedCount();
  const failed = await anchorQueue.getFailedCount();
  
  return {
    jobs_completed: completed,
    jobs_failed: failed,
    uptime_seconds: process.uptime(),
  };
});

export async function startHealthServer(): Promise<void> {
  await healthServer.listen({ port: 8011, host: '0.0.0.0' });
  console.log('Worker health server on port 8011');
}
```

---

## Completion Criteria

- [ ] All 12 stories implemented
- [ ] Worker processes anchor jobs
- [ ] Solana adapter functional
- [ ] EVM adapter functional (Base at minimum)
- [ ] Merkle batching working
- [ ] Confirmation tracking working
- [ ] Worker health endpoint
- [ ] Docker build succeeds
- [ ] Integration tests pass (with devnet)
