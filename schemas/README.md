# VCOT Schema Specification

**VCOT (Verifiable Chain of Thought)** is an open standard for AI agent auditability.

## Overview

VCOT defines a schema for logging AI agent events in a way that is:

- **Verifiable** — Anyone can independently verify events using public blockchain data
- **Immutable** — Events are anchored to blockchain, making tampering detectable
- **Privacy-preserving** — Only hashes are stored; raw content never leaves the agent's environment
- **Chain-agnostic** — Works with any blockchain (Solana, EVM via EAS, Bitcoin)
- **Framework-neutral** — Works with any AI agent framework

## Schema Files

| File | Description |
|------|-------------|
| `vcot-v1.json` | JSON Schema for VCOT v0.1 events |

## Event Types

| Type | Description |
|------|-------------|
| `decision` | Agent made a choice or decision |
| `tool_call` | Agent invoked a tool |
| `tool_result` | Tool returned a result |
| `memory_write` | Agent wrote to persistent memory |
| `memory_read` | Agent read from memory |
| `external_action` | Agent took external action (email, API, etc.) |
| `state_change` | Agent state transition |
| `observation` | Agent observed/ingested data |
| `custom` | User-defined event type |

## Hash Chain

Events form a cryptographic hash chain:

```
event_hash = SHA-256(event_id || event_type || timestamp || agent_id || content_hash || previous_hash)
```

The first event in a chain uses the genesis hash: `sha256:0000...0000` (64 zeros).

## Content Hashing

Content is hashed using canonical JSON serialization:

```
content_hash = SHA-256(canonical_json(content))
```

Canonical JSON rules:
- Keys sorted alphabetically
- No whitespace
- UTF-8 NFC normalized

## Framework Signing

Events are signed with Ed25519:

```
signature = Ed25519_Sign(framework_private_key, event_hash)
```

The framework publishes its public key for verification.

## Verification

Anyone can verify an event:

1. Obtain event data + Merkle proof
2. Recompute event_hash from event data
3. Walk Merkle proof to compute Merkle root
4. Read anchor transaction from public blockchain
5. Compare computed root with on-chain root
6. Verify framework signature

If all checks pass, the event existed at anchoring time and hasn't been modified.

## License

The VCOT schema specification is licensed under CC-BY-SA 4.0.
