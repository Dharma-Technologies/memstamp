# Verification Guide

## How Verification Works

memstamp creates **independently verifiable** audit trails. You don't need to trust memstamp — you can verify everything yourself using public blockchain data.

### Verification Flow

```
1. Get the stamp (event data + Merkle proof)
2. Recompute the content hash from your local data
3. Walk the Merkle proof to compute the Merkle root
4. Read the anchor transaction from the public blockchain
5. Compare: computed root === on-chain root
6. Verify the framework signature
```

If all checks pass, the stamp is verified: the event existed at anchoring time and hasn't been tampered with.

## Using the SDK

### TypeScript

```typescript
import { verifyStamp } from '@memstamp/core';

const result = await verifyStamp(stampId, {
  chain: 'solana',
  rpc: 'https://api.mainnet-beta.solana.com',
});

if (result.verified) {
  console.log(`✅ Verified on ${result.chain}`);
  console.log(`   Block: ${result.blockNumber}`);
  console.log(`   Tx: ${result.anchorTx}`);
  console.log(`   Time: ${result.anchorTimestamp}`);
} else {
  console.log(`❌ Failed: ${result.error}`);
}
```

### Python

```python
from memstamp import MemstampClient

client = MemstampClient(api_key="ms_live_xxx")
result = client.verify("stamp_abc123")

print(f"Verified: {result.verified}")
print(f"Chain: {result.chain}")
print(f"Anchor tx: {result.anchor_tx}")
```

### CLI

```bash
# Verify a stamp
memstamp verify stamp_abc123

# Verify against a specific chain
memstamp verify stamp_abc123 --chain solana --rpc https://api.mainnet-beta.solana.com
```

## Manual Verification (No SDK)

You can verify stamps without any memstamp software:

### 1. Get the stamp data

```bash
curl https://api.memstamp.io/v1/stamps/stamp_abc123
```

### 2. Get the Merkle proof

```bash
curl https://api.memstamp.io/v1/stamps/stamp_abc123/proof
```

### 3. Verify on-chain

Using the anchor transaction hash, look it up on any block explorer:
- **Solana:** [Solscan](https://solscan.io) or [Explorer](https://explorer.solana.com)
- **Base:** [BaseScan](https://basescan.org)
- **Bitcoin:** [Mempool.space](https://mempool.space)

The on-chain data contains the Merkle root. Recompute it from the proof and compare.

## Verification Levels

| Level | What's Verified | Trust Required |
|-------|----------------|----------------|
| **Hash** | Content matches hash | None |
| **Chain** | Hash chain integrity | None |
| **Anchor** | On-chain existence | Blockchain consensus |
| **Signature** | Framework attestation | Framework's public key |
| **Full** | All of the above | None (trustless) |
