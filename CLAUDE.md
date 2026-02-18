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

## Current Stage: P11-05-billing-sdk

# P11-05: Billing & SDK

**Phase 5 — Credit System & Python SDK**

Implement the credit billing system and build the Python SDK.

---

## Stories

### Story 1: Credit Service
**File:** `packages/api/src/services/credits.ts`

Implement credit management service.

```typescript
export class CreditService {
  // Get current balance
  async getBalance(accountId: string): Promise<number> {
    const account = await accountRepo.findById(accountId);
    return account?.credits ?? 0;
  }
  
  // Check if account has enough credits
  async hasCredits(accountId: string, required: number): Promise<boolean> {
    const balance = await this.getBalance(accountId);
    return balance >= required;
  }
  
  // Deduct credits (atomic operation)
  async deduct(
    accountId: string,
    amount: number,
    reason: string,
    stampId?: string
  ): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // Get current balance with FOR UPDATE lock
      const [account] = await tx
        .select({ credits: accounts.credits })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .for('update');
      
      if (!account || account.credits < amount) {
        return false;
      }
      
      // Deduct
      await tx
        .update(accounts)
        .set({ credits: sql`${accounts.credits} - ${amount}` })
        .where(eq(accounts.id, accountId));
      
      // Record transaction
      await tx.insert(creditTransactions).values({
        accountId,
        amount: -amount,
        type: 'deduct',
        reason,
        stampId,
      });
      
      return true;
    });
  }
  
  // Add credits (purchase)
  async addCredits(
    accountId: string,
    amount: number,
    reason: string
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(accounts)
        .set({ credits: sql`${accounts.credits} + ${amount}` })
        .where(eq(accounts.id, accountId));
      
      await tx.insert(creditTransactions).values({
        accountId,
        amount,
        type: 'purchase',
        reason,
      });
    });
  }
  
  // Get transaction history
  async getTransactions(
    accountId: string,
    options: { limit: number; offset: number }
  ): Promise<CreditTransaction[]> {
    return await db.query.creditTransactions.findMany({
      where: eq(creditTransactions.accountId, accountId),
      limit: options.limit,
      offset: options.offset,
      orderBy: desc(creditTransactions.createdAt),
    });
  }
  
  // Calculate cost for stamps
  calculateCost(stampCount: number, chain: string): number {
    const costPerStamp = CHAIN_COSTS[chain] ?? 1;
    return stampCount * costPerStamp;
  }
}

const CHAIN_COSTS: Record<string, number> = {
  solana: 1,
  base: 2,
  arbitrum: 3,
  ethereum: 20,
  bitcoin: 50,
};
```

---

### Story 2: Credit Endpoints
**File:** `packages/api/src/routes/account.ts`

Implement credit-related endpoints.

**GET /v1/account/credits:**
```typescript
{
  balance: number;
  tier: string;
  usage_this_month: number;
}
```

**GET /v1/account/credits/transactions:**
```typescript
{
  transactions: Array<{
    id: string;
    amount: number;
    type: 'purchase' | 'deduct' | 'refund' | 'bonus';
    reason: string;
    stamp_id?: string;
    created_at: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}
```

**POST /v1/account/credits/purchase:**
Request:
```typescript
{
  credits: number;  // Must be in valid packages: 1000, 10000, 100000, 1000000
  payment_method_id?: string;  // Stripe payment method
}
```

Response:
```typescript
{
  success: boolean;
  credits_added: number;
  new_balance: number;
  payment_id?: string;
}
```

---

### Story 3: Stripe Integration
**File:** `packages/api/src/services/stripe.ts`

Implement Stripe payment processing.

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(config.stripeSecretKey);

// Credit packages
const PACKAGES = {
  1000: { price: 1000, credits: 1000 },      // $10
  10000: { price: 7500, credits: 10000 },    // $75
  100000: { price: 50000, credits: 100000 }, // $500
  1000000: { price: 300000, credits: 1000000 }, // $3000
};

export class StripeService {
  async createPaymentIntent(
    accountId: string,
    creditPackage: number
  ): Promise<{ clientSecret: string; paymentId: string }> {
    const pkg = PACKAGES[creditPackage];
    if (!pkg) {
      throw new ValidationError('Invalid credit package');
    }
    
    const account = await accountRepo.findById(accountId);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: pkg.price,
      currency: 'usd',
      metadata: {
        accountId,
        credits: pkg.credits.toString(),
      },
    });
    
    return {
      clientSecret: paymentIntent.client_secret!,
      paymentId: paymentIntent.id,
    };
  }
  
  async handleWebhook(payload: string, signature: string): Promise<void> {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      config.stripeWebhookSecret
    );
    
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { accountId, credits } = paymentIntent.metadata;
      
      await creditService.addCredits(
        accountId,
        parseInt(credits),
        `Purchase: ${credits} credits`
      );
    }
  }
}
```

---

### Story 4: Free Tier Handling
**File:** `packages/api/src/services/credits.ts`

Handle free tier (transparency log only, no blockchain).

```typescript
// In stamp creation
async function createStampWithFreeOption(
  accountId: string,
  input: CreateStampInput,
  chain: string
): Promise<Stamp> {
  const cost = creditService.calculateCost(1, chain);
  const hasCredits = await creditService.hasCredits(accountId, cost);
  
  if (!hasCredits) {
    // Check if free tier eligible
    const account = await accountRepo.findById(accountId);
    
    if (account.tier === 'free') {
      // Create stamp without chain anchoring
      // Still provides append-only Merkle log, just not anchored to blockchain
      return await stampService.create(accountId, {
        ...input,
        chainless: true, // Flag for no blockchain anchoring
      });
    }
    
    throw new InsufficientCreditsError(cost, account.credits);
  }
  
  // Normal path with credits
  await creditService.deduct(accountId, cost, `Stamp on ${chain}`);
  return await stampService.create(accountId, input);
}
```

---

### Story 5: Python SDK — Package Setup
**File:** `packages/python/setup.py`, `packages/python/pyproject.toml`

Set up Python package properly.

**pyproject.toml:**
```toml
[build-system]
requires = ["setuptools>=61.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "memstamp"
version = "0.1.0"
description = "Python SDK for memstamp — verifiable audit trails for AI agents"
readme = "README.md"
license = {text = "MIT"}
authors = [
  {name = "Dharma Technologies", email = "hello@dharma.us"}
]
requires-python = ">=3.10"
classifiers = [
  "Development Status :: 3 - Alpha",
  "Intended Audience :: Developers",
  "License :: OSI Approved :: MIT License",
  "Programming Language :: Python :: 3",
  "Programming Language :: Python :: 3.10",
  "Programming Language :: Python :: 3.11",
  "Programming Language :: Python :: 3.12",
]
dependencies = [
  "httpx>=0.25.0",
  "pydantic>=2.5.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=7.4.0",
  "pytest-asyncio>=0.23.0",
  "ruff>=0.1.0",
  "mypy>=1.8.0",
]
langchain = ["langchain>=0.1.0"]
mem0 = ["mem0ai>=0.0.1"]

[project.urls]
"Homepage" = "https://memstamp.io"
"Documentation" = "https://memstamp.io/docs"
"Source" = "https://github.com/Dharma-Technologies/memstamp"

[tool.ruff]
target-version = "py310"
line-length = 100
select = ["E", "F", "W", "I", "N", "UP"]

[tool.mypy]
python_version = "3.10"
strict = true
```

---

### Story 6: Python SDK — Client
**File:** `packages/python/memstamp/client.py`

Implement the main SDK client.

```python
from typing import Any, Optional
from datetime import datetime
import hashlib
import json

import httpx
from pydantic import BaseModel

from memstamp.types import Stamp, VerificationResult, VCOTEventType


class MemstampClient:
    """
    Client for the memstamp API.
    
    Args:
        api_key: Your memstamp API key (ms_live_xxx or ms_test_xxx)
        base_url: API base URL (default: https://api.memstamp.io)
        timeout: Request timeout in seconds
    
    Example:
        >>> client = MemstampClient(api_key="ms_live_xxx")
        >>> stamp = client.stamp(
        ...     agent_id="my-agent",
        ...     event_type="decision",
        ...     content={"action": "approved_loan", "amount": 50000}
        ... )
        >>> print(f"Stamp created: {stamp.id}")
    """
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.memstamp.io",
        timeout: float = 30.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )
    
    def stamp(
        self,
        agent_id: str,
        event_type: VCOTEventType,
        content: Any,
        framework: str = "memstamp-py/0.1",
        signature: str = "",
        metadata: Optional[dict[str, Any]] = None,
    ) -> Stamp:
        """
        Create a stamp for an agent event.
        
        The content is hashed locally — raw content never leaves your environment.
        """
        content_hash = self._compute_hash(content)
        
        response = self._client.post(
            "/v1/stamps",
            json={
                "agent_id": agent_id,
                "event_type": event_type,
                "content_hash": content_hash,
                "framework": framework,
                "signature": signature or self._generate_placeholder_signature(),
                "metadata": metadata,
            },
        )
        response.raise_for_status()
        return Stamp(**response.json())
    
    def stamp_batch(
        self,
        stamps: list[dict[str, Any]],
    ) -> list[Stamp]:
        """Create multiple stamps at once."""
        processed = []
        for s in stamps:
            processed.append({
                "agent_id": s["agent_id"],
                "event_type": s["event_type"],
                "content_hash": self._compute_hash(s["content"]),
                "framework": s.get("framework", "memstamp-py/0.1"),
                "signature": s.get("signature", self._generate_placeholder_signature()),
                "metadata": s.get("metadata"),
            })
        
        response = self._client.post(
            "/v1/stamps/batch",
            json={"stamps": processed},
        )
        response.raise_for_status()
        return [Stamp(**s) for s in response.json()["stamps"]]
    
    def verify(self, stamp_id: str) -> VerificationResult:
        """Verify a stamp against the blockchain."""
        response = self._client.get(f"/v1/stamps/{stamp_id}/verify")
        response.raise_for_status()
        return VerificationResult(**response.json())
    
    def get_stamp(self, stamp_id: str) -> Stamp:
        """Get a stamp by ID."""
        response = self._client.get(f"/v1/stamps/{stamp_id}")
        response.raise_for_status()
        return Stamp(**response.json())
    
    def list_stamps(
        self,
        agent_id: str,
        limit: int = 50,
        offset: int = 0,
        status: Optional[str] = None,
    ) -> tuple[list[Stamp], int]:
        """List stamps for an agent."""
        params = {"limit": limit, "offset": offset}
        if status:
            params["status"] = status
        
        response = self._client.get(
            f"/v1/agents/{agent_id}/stamps",
            params=params,
        )
        response.raise_for_status()
        data = response.json()
        return [Stamp(**s) for s in data["stamps"]], data["total"]
    
    def get_audit_trail(self, agent_id: str) -> dict[str, Any]:
        """Get the audit trail for an agent."""
        response = self._client.get(f"/v1/agents/{agent_id}/trail")
        response.raise_for_status()
        return response.json()
    
    def get_credits(self) -> dict[str, Any]:
        """Get account credit balance."""
        response = self._client.get("/v1/account/credits")
        response.raise_for_status()
        return response.json()
    
    def _compute_hash(self, content: Any) -> str:
        """Compute SHA-256 hash with canonical JSON serialization."""
        canonical = json.dumps(content, sort_keys=True, separators=(",", ":"))
        hash_bytes = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        return f"sha256:{hash_bytes}"
    
    def _generate_placeholder_signature(self) -> str:
        """Generate a placeholder signature for testing."""
        return "placeholder_signature"
    
    def close(self):
        """Close the HTTP client."""
        self._client.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        self.close()


class AsyncMemstampClient:
    """Async version of MemstampClient."""
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.memstamp.io",
        timeout: float = 30.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )
    
    async def stamp(
        self,
        agent_id: str,
        event_type: VCOTEventType,
        content: Any,
        framework: str = "memstamp-py/0.1",
        signature: str = "",
        metadata: Optional[dict[str, Any]] = None,
    ) -> Stamp:
        content_hash = self._compute_hash(content)
        
        response = await self._client.post(
            "/v1/stamps",
            json={
                "agent_id": agent_id,
                "event_type": event_type,
                "content_hash": content_hash,
                "framework": framework,
                "signature": signature or "placeholder",
                "metadata": metadata,
            },
        )
        response.raise_for_status()
        return Stamp(**response.json())
    
    # ... async versions of other methods ...
    
    def _compute_hash(self, content: Any) -> str:
        canonical = json.dumps(content, sort_keys=True, separators=(",", ":"))
        hash_bytes = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        return f"sha256:{hash_bytes}"
    
    async def close(self):
        await self._client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, *args):
        await self.close()
```

---

### Story 7: Python SDK — LangChain Integration
**File:** `packages/python/memstamp/integrations/langchain.py`

LangChain callback handler.

```python
"""LangChain integration for automatic stamping."""

from typing import Any, Optional, List, Dict, Union
from uuid import UUID

try:
    from langchain.callbacks.base import BaseCallbackHandler
except ImportError:
    raise ImportError("langchain is required: pip install memstamp[langchain]")

from memstamp.client import MemstampClient


class MemstampCallbackHandler(BaseCallbackHandler):
    """
    LangChain callback handler that stamps events to memstamp.
    
    Example:
        >>> from memstamp.integrations.langchain import MemstampCallbackHandler
        >>> handler = MemstampCallbackHandler(
        ...     api_key="ms_live_xxx",
        ...     agent_id="my-langchain-agent"
        ... )
        >>> chain.invoke(input, callbacks=[handler])
    """
    
    def __init__(
        self,
        api_key: str,
        agent_id: str,
        base_url: str = "https://api.memstamp.io",
        stamp_on: Optional[List[str]] = None,
    ):
        self.client = MemstampClient(api_key=api_key, base_url=base_url)
        self.agent_id = agent_id
        self.stamp_on = stamp_on or [
            "on_llm_start",
            "on_llm_end", 
            "on_tool_start",
            "on_tool_end",
        ]
    
    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        **kwargs: Any,
    ) -> None:
        if "on_llm_start" not in self.stamp_on:
            return
        
        self.client.stamp(
            agent_id=self.agent_id,
            event_type="tool_call",
            content={
                "type": "llm_start",
                "model": serialized.get("name", "unknown"),
                "prompts": prompts,
            },
            framework="langchain",
        )
    
    def on_llm_end(
        self,
        response: Any,
        **kwargs: Any,
    ) -> None:
        if "on_llm_end" not in self.stamp_on:
            return
        
        self.client.stamp(
            agent_id=self.agent_id,
            event_type="tool_result",
            content={
                "type": "llm_end",
                "generations": str(response.generations) if hasattr(response, 'generations') else str(response),
            },
            framework="langchain",
        )
    
    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        **kwargs: Any,
    ) -> None:
        if "on_tool_start" not in self.stamp_on:
            return
        
        self.client.stamp(
            agent_id=self.agent_id,
            event_type="tool_call",
            content={
                "type": "tool_start",
                "tool": serialized.get("name", "unknown"),
                "input": input_str,
            },
            framework="langchain",
        )
    
    def on_tool_end(
        self,
        output: str,
        **kwargs: Any,
    ) -> None:
        if "on_tool_end" not in self.stamp_on:
            return
        
        self.client.stamp(
            agent_id=self.agent_id,
            event_type="tool_result",
            content={
                "type": "tool_end",
                "output": output,
            },
            framework="langchain",
        )
    
    def on_chain_start(
        self,
        serialized: Dict[str, Any],
        inputs: Dict[str, Any],
        **kwargs: Any,
    ) -> None:
        if "on_chain_start" not in self.stamp_on:
            return
        
        self.client.stamp(
            agent_id=self.agent_id,
            event_type="state_change",
            content={
                "type": "chain_start",
                "chain": serialized.get("name", "unknown"),
            },
            framework="langchain",
        )
    
    def on_chain_end(
        self,
        outputs: Dict[str, Any],
        **kwargs: Any,
    ) -> None:
        if "on_chain_end" not in self.stamp_on:
            return
        
        self.client.stamp(
            agent_id=self.agent_id,
            event_type="state_change",
            content={
                "type": "chain_end",
            },
            framework="langchain",
        )
```

---

### Story 8: Python SDK — mem0 Integration
**File:** `packages/python/memstamp/integrations/mem0.py`

mem0 integration for memory stamping.

```python
"""mem0 integration for stamping memory operations."""

from typing import Any, Optional

from memstamp.client import MemstampClient


class MemstampMem0Hook:
    """
    Hook for mem0 that stamps memory operations.
    
    Example:
        >>> from mem0 import Memory
        >>> from memstamp.integrations.mem0 import MemstampMem0Hook
        >>> 
        >>> hook = MemstampMem0Hook(api_key="ms_live_xxx", agent_id="my-agent")
        >>> m = Memory()
        >>> m.add_hooks(hook)
    """
    
    def __init__(
        self,
        api_key: str,
        agent_id: str,
        base_url: str = "https://api.memstamp.io",
    ):
        self.client = MemstampClient(api_key=api_key, base_url=base_url)
        self.agent_id = agent_id
    
    def on_add(
        self,
        messages: list[dict[str, Any]],
        user_id: str,
        agent_id: Optional[str] = None,
        **kwargs: Any,
    ) -> None:
        """Called when memory is added."""
        self.client.stamp(
            agent_id=self.agent_id,
            event_type="memory_write",
            content={
                "operation": "add",
                "user_id": user_id,
                "message_count": len(messages),
            },
            framework="mem0",
        )
    
    def on_search(
        self,
        query: str,
        user_id: str,
        **kwargs: Any,
    ) -> None:
        """Called when memory is searched."""
        self.client.stamp(
            agent_id=self.agent_id,
            event_type="memory_read",
            content={
                "operation": "search",
                "user_id": user_id,
                "query_length": len(query),
            },
            framework="mem0",
        )
    
    def on_delete(
        self,
        memory_id: str,
        **kwargs: Any,
    ) -> None:
        """Called when memory is deleted."""
        self.client.stamp(
            agent_id=self.agent_id,
            event_type="memory_write",
            content={
                "operation": "delete",
                "memory_id": memory_id,
            },
            framework="mem0",
        )
```

---

### Story 9: Python SDK — Tests
**File:** `packages/python/tests/`

Comprehensive tests for Python SDK.

```python
# tests/test_client.py
import pytest
from memstamp.client import MemstampClient


class TestMemstampClient:
    def test_compute_hash_deterministic(self):
        client = MemstampClient(api_key="test", base_url="http://localhost:8010")
        
        hash1 = client._compute_hash({"a": 1, "b": 2})
        hash2 = client._compute_hash({"b": 2, "a": 1})
        
        assert hash1 == hash2
        assert hash1.startswith("sha256:")
    
    def test_hash_different_content(self):
        client = MemstampClient(api_key="test", base_url="http://localhost:8010")
        
        hash1 = client._compute_hash({"a": 1})
        hash2 = client._compute_hash({"a": 2})
        
        assert hash1 != hash2
    
    def test_hash_format(self):
        client = MemstampClient(api_key="test", base_url="http://localhost:8010")
        
        h = client._compute_hash({"test": True})
        
        assert h.startswith("sha256:")
        assert len(h) == 7 + 64  # prefix + 64 hex chars


# tests/test_types.py
from memstamp.types import Stamp, VerificationResult


def test_stamp_model():
    stamp = Stamp(
        id="test-id",
        event_id="event-123",
        content_hash="sha256:abc123",
        previous_hash="sha256:000000",
        agent_id="agent-1",
        event_type="decision",
        status="pending",
        created_at="2026-01-01T00:00:00Z",
    )
    
    assert stamp.id == "test-id"
    assert stamp.status == "pending"
```

---

### Story 10: Python SDK — PyPI Publishing
**File:** `.github/workflows/python-publish.yml`

GitHub Action for PyPI publishing.

```yaml
name: Publish Python Package

on:
  release:
    types: [published]
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: pypi
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install build tools
        run: |
          pip install build twine
      
      - name: Build package
        run: |
          cd packages/python
          python -m build
      
      - name: Publish to PyPI
        env:
          TWINE_USERNAME: __token__
          TWINE_PASSWORD: ${{ secrets.PYPI_TOKEN }}
        run: |
          cd packages/python
          twine upload dist/*
```

---

## Completion Criteria

- [ ] All 10 stories implemented
- [ ] Credit deduction working on stamp creation
- [ ] Stripe integration tested
- [ ] Python SDK installable with pip
- [ ] LangChain integration works
- [ ] mem0 integration works
- [ ] Python SDK tests pass
- [ ] PyPI publish workflow ready
