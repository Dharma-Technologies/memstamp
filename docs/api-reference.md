# API Reference

> REST API for the memstamp anchoring service.

## Base URL

```
http://localhost:8010/v1
```

> **Note:** This assumes a self-hosted instance. A hosted version is coming — check the [GitHub repo](https://github.com/Dharma-Technologies/memstamp) for updates.

## Authentication

API requests require an API key in the `Authorization` header:

```
Authorization: Bearer ms_live_xxx
```

## Endpoints

### Stamps

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/stamps` | Create a new stamp |
| `GET` | `/stamps/:id` | Get stamp by ID |
| `GET` | `/stamps/:id/verify` | Verify a stamp on-chain |
| `GET` | `/stamps` | List stamps (paginated) |

### Agents

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/agents` | Register an agent |
| `GET` | `/agents/:id` | Get agent info |
| `GET` | `/agents/:id/stamps` | List stamps for agent |

### Anchors

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/anchors/:id` | Get anchor details |
| `GET` | `/anchors/:id/proof` | Get Merkle proof |

## Rate Limits

| Tier | Requests/min | Stamps/day |
|------|-------------|------------|
| Free | 60 | 1,000 |
| Pro | 600 | 100,000 |
| Enterprise | Unlimited | Unlimited |

## Errors

All errors follow RFC 7807 Problem Details:

```json
{
  "type": "https://github.com/Dharma-Technologies/memstamp/problems/invalid-hash",
  "title": "Invalid Content Hash",
  "status": 400,
  "detail": "Content hash must match pattern: sha256:[a-f0-9]{64}"
}
```
