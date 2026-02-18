# memstamp-py

Python SDK for [memstamp](https://memstamp.io) — verifiable audit trails for AI agents.

## Installation

```bash
pip install memstamp
```

## Quick Start

```python
from memstamp import MemstampClient

client = MemstampClient(api_key="ms_live_xxx")

# Create a stamp
stamp = client.stamp(
    agent_id="my-agent",
    event_type="decision",
    content={"action": "approved_loan", "amount": 50000}
)

print(f"Stamp created: {stamp.id}")
print(f"Content hash: {stamp.content_hash}")

# Verify a stamp
result = client.verify(stamp.id)
print(f"Verified: {result.verified}")
print(f"Chain TX: {result.anchor_tx}")
```

## LangChain Integration

```python
from memstamp.integrations.langchain import MemstampCallbackHandler

handler = MemstampCallbackHandler(api_key="ms_live_xxx", agent_id="my-agent")

# Use with any LangChain chain/agent
chain.invoke(input, callbacks=[handler])
```

## License

MIT
