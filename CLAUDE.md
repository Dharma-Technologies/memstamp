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

## Current Stage: P11-02-api-foundation

# P11-02: API Foundation

**Phase 2 — API Server Setup**

Build the Fastify API server with database models, authentication, and foundational endpoints.

---

## Stories

### Story 1: Fastify Server Setup
**File:** `packages/api/src/index.ts`

Set up the Fastify server with essential plugins.

**Plugins to configure:**
- `@fastify/cors` — CORS headers
- `@fastify/helmet` — Security headers
- `@fastify/rate-limit` — Rate limiting
- `@fastify/swagger` — OpenAPI generation
- `@fastify/swagger-ui` — Swagger UI

**Configuration:**
```typescript
const app = Fastify({
  logger: {
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
  },
});

// CORS
await app.register(cors, {
  origin: config.corsOrigins,
});

// Security headers
await app.register(helmet);

// Rate limiting
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Swagger
await app.register(swagger, {
  openapi: {
    info: {
      title: 'memstamp API',
      version: '0.1.0',
    },
    servers: [{ url: config.apiUrl }],
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
        },
      },
    },
  },
});

await app.register(swaggerUi, {
  routePrefix: '/docs',
});
```

---

### Story 2: Configuration Module
**File:** `packages/api/src/config.ts`

Create typed configuration from environment variables.

**Config structure:**
```typescript
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('8010'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  API_URL: z.string().url().default('http://localhost:8010'),
  CORS_ORIGINS: z.string().default('*'),
  
  // Chain configuration
  HELIUS_API_KEY: z.string().optional(),
  ALCHEMY_API_KEY: z.string().optional(),
  SOLANA_RPC_URL: z.string().url().optional(),
  SOLANA_PRIVATE_KEY: z.string().optional(),
  BASE_RPC_URL: z.string().url().optional(),
  EVM_PRIVATE_KEY: z.string().optional(),
  
  // Anchoring
  ANCHOR_BATCH_SIZE: z.string().default('1000'),
  ANCHOR_TIME_WINDOW_MS: z.string().default('300000'),
  DEFAULT_CHAIN: z.string().default('solana'),
});

export const config = envSchema.parse(process.env);
```

**Error handling:**
- If validation fails, log missing/invalid vars and exit

---

### Story 3: Database Connection (Drizzle)
**File:** `packages/api/src/database/connection.ts`

Set up Drizzle ORM with PostgreSQL.

**Dependencies:**
- `drizzle-orm`
- `pg`
- `drizzle-kit` (dev)

**Connection:**
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: config.databaseUrl,
});

export const db = drizzle(pool, { schema });
```

**drizzle.config.ts:**
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/database/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

---

### Story 4: Database Schema — Accounts
**File:** `packages/api/src/database/schema.ts`

Define the accounts table.

```typescript
import { pgTable, uuid, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const tierEnum = pgEnum('tier', ['free', 'pro', 'enterprise']);

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  apiKeyHash: text('api_key_hash').notNull().unique(),
  apiKeyPrefix: text('api_key_prefix').notNull(), // First 8 chars for identification
  credits: integer('credits').notNull().default(500), // Free tier starts with 500
  tier: tierEnum('tier').notNull().default('free'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

---

### Story 5: Database Schema — Stamps
**File:** `packages/api/src/database/schema.ts`

Define the stamps table.

```typescript
export const stampStatusEnum = pgEnum('stamp_status', ['pending', 'anchored', 'verified']);

export const stamps = pgTable('stamps', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  eventId: text('event_id').notNull().unique(),
  agentId: text('agent_id').notNull(),
  eventType: text('event_type').notNull(),
  contentHash: text('content_hash').notNull(),
  previousHash: text('previous_hash').notNull(),
  framework: text('framework').notNull(),
  signature: text('signature').notNull(),
  status: stampStatusEnum('status').notNull().default('pending'),
  anchorId: uuid('anchor_id').references(() => anchors.id),
  merkleIndex: integer('merkle_index'), // Position in Merkle tree
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  agentIdIdx: index('stamps_agent_id_idx').on(table.agentId),
  accountIdIdx: index('stamps_account_id_idx').on(table.accountId),
  statusIdx: index('stamps_status_idx').on(table.status),
  createdAtIdx: index('stamps_created_at_idx').on(table.createdAt),
}));
```

---

### Story 6: Database Schema — Anchors
**File:** `packages/api/src/database/schema.ts`

Define the anchors table.

```typescript
export const anchorStatusEnum = pgEnum('anchor_status', ['pending', 'confirmed', 'finalized']);

export const anchors = pgTable('anchors', {
  id: uuid('id').primaryKey().defaultRandom(),
  merkleRoot: text('merkle_root').notNull().unique(),
  eventCount: integer('event_count').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  chain: text('chain').notNull(), // solana, base, bitcoin, etc.
  txHash: text('tx_hash'),
  blockNumber: integer('block_number'),
  status: anchorStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  merkleRootIdx: index('anchors_merkle_root_idx').on(table.merkleRoot),
  chainIdx: index('anchors_chain_idx').on(table.chain),
  statusIdx: index('anchors_status_idx').on(table.status),
}));
```

---

### Story 7: Database Schema — Credit Transactions
**File:** `packages/api/src/database/schema.ts`

Define the credit transactions table.

```typescript
export const creditTypeEnum = pgEnum('credit_type', ['purchase', 'deduct', 'refund', 'bonus']);

export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  amount: integer('amount').notNull(), // Positive for credits, negative for debits
  type: creditTypeEnum('type').notNull(),
  reason: text('reason').notNull(),
  stampId: uuid('stamp_id').references(() => stamps.id), // Optional reference
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  accountIdIdx: index('credit_tx_account_id_idx').on(table.accountId),
}));
```

---

### Story 8: Generate Initial Migration
**Command:** Run Drizzle migration generation

```bash
cd packages/api
pnpm db:generate
```

**Verify:**
- Migration file created in `drizzle/` directory
- Migration includes all tables and indexes
- Enums created before tables

---

### Story 9: API Key Authentication Middleware
**File:** `packages/api/src/middleware/auth.ts`

Implement API key authentication.

**API Key Format:** `ms_live_<random32chars>` or `ms_test_<random32chars>`

**Functions:**
```typescript
import { createHash } from 'crypto';

// Hash API key for storage
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

// Extract prefix (for identification without exposing full key)
export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.substring(0, 8);
}

// Generate new API key
export function generateApiKey(isTest: boolean = false): string {
  const prefix = isTest ? 'ms_test_' : 'ms_live_';
  const random = crypto.randomBytes(24).toString('base64url');
  return `${prefix}${random}`;
}
```

**Middleware:**
```typescript
export const authMiddleware: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    const authHeader = request.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      throw app.httpErrors.unauthorized('Missing API key');
    }
    
    const apiKey = authHeader.substring(7);
    const hash = hashApiKey(apiKey);
    
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.apiKeyHash, hash),
    });
    
    if (!account) {
      throw app.httpErrors.unauthorized('Invalid API key');
    }
    
    request.account = account;
  });
};
```

**TypeScript declaration:**
```typescript
declare module 'fastify' {
  interface FastifyRequest {
    account: typeof accounts.$inferSelect;
  }
}
```

---

### Story 10: Health Check Endpoint
**File:** `packages/api/src/routes/health.ts`

Implement health check endpoint.

```typescript
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            database: { type: 'string' },
            redis: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    // Check database
    let dbStatus = 'ok';
    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      dbStatus = 'error';
    }
    
    // Check Redis
    let redisStatus = 'ok';
    try {
      await redis.ping();
    } catch {
      redisStatus = 'error';
    }
    
    return {
      status: dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      redis: redisStatus,
    };
  });
};
```

---

### Story 11: Redis Connection
**File:** `packages/api/src/services/redis.ts`

Set up Redis connection with IORedis.

```typescript
import IORedis from 'ioredis';
import { config } from '../config';

export const redis = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected');
});
```

---

### Story 12: Error Handling
**File:** `packages/api/src/errors.ts`

Define custom error types and error handler.

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public errors?: string[]) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(required: number, available: number) {
    super(`Insufficient credits. Required: ${required}, Available: ${available}`, 402, 'INSUFFICIENT_CREDITS');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}
```

**Error handler plugin:**
```typescript
export const errorHandler: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        ...(error instanceof ValidationError && error.errors ? { errors: error.errors } : {}),
      });
    }
    
    // Log unexpected errors
    request.log.error(error);
    
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  });
};
```

---

### Story 13: Request Validation with Zod
**File:** `packages/api/src/schemas/index.ts`

Define Zod schemas for request validation.

```typescript
import { z } from 'zod';

// Common schemas
export const uuidSchema = z.string().uuid();
export const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const eventTypeSchema = z.enum([
  'decision', 'tool_call', 'tool_result', 'memory_write',
  'memory_read', 'external_action', 'state_change', 'observation', 'custom'
]);

// Pagination
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Create stamp request
export const createStampSchema = z.object({
  agent_id: z.string().min(1).max(256),
  event_type: eventTypeSchema,
  content_hash: hashSchema,
  previous_hash: hashSchema.optional(),
  framework: z.string().min(1).max(64).default('unknown'),
  signature: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

// Batch create stamps
export const batchCreateStampsSchema = z.object({
  stamps: z.array(createStampSchema).min(1).max(1000),
});
```

---

### Story 14: Route Registration
**File:** `packages/api/src/routes/index.ts`

Set up route registration with prefixes.

```typescript
import { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health';
import { stampsRoutes } from './stamps';
import { accountRoutes } from './account';
import { anchorsRoutes } from './anchors';
import { publicRoutes } from './public';

export const registerRoutes: FastifyPluginAsync = async (app) => {
  // Public routes (no auth)
  await app.register(healthRoutes);
  await app.register(publicRoutes, { prefix: '/v1' });
  
  // Authenticated routes
  await app.register(async (authenticatedApp) => {
    await authenticatedApp.register(authMiddleware);
    await authenticatedApp.register(stampsRoutes, { prefix: '/v1/stamps' });
    await authenticatedApp.register(accountRoutes, { prefix: '/v1/account' });
    await authenticatedApp.register(anchorsRoutes, { prefix: '/v1/anchors' });
  });
};
```

---

### Story 15: Docker Setup
**Files:**
- `packages/api/Dockerfile`
- `docker-compose.yml` (update)

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY . .
RUN pnpm turbo build --filter=@memstamp/api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 memstamp
COPY --from=builder --chown=memstamp:nodejs /app/packages/api/dist ./dist
COPY --from=builder --chown=memstamp:nodejs /app/packages/api/drizzle ./drizzle
COPY --from=builder --chown=memstamp:nodejs /app/packages/api/package.json ./
USER memstamp
EXPOSE 8010
CMD ["node", "dist/index.js"]
```

**Verify:**
```bash
docker compose build api
docker compose up -d
curl http://localhost:8010/health
```

---

## Completion Criteria

- [ ] All 15 stories implemented
- [ ] Database schema created and migrations work
- [ ] API key authentication functional
- [ ] Health endpoint returns database/redis status
- [ ] Error handling consistent
- [ ] Swagger UI accessible at /docs
- [ ] Docker build succeeds
- [ ] All TypeScript strict, no errors
