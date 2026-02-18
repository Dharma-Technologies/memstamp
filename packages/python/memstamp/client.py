"""
memstamp API client
"""

import hashlib
import json
from datetime import datetime
from typing import Any, Optional

import httpx

from memstamp.types import Stamp, VerificationResult, VCOTEventType


class MemstampClient:
    """
    Client for the memstamp API.
    
    Example:
        >>> client = MemstampClient(api_key="ms_live_xxx")
        >>> stamp = client.stamp(
        ...     agent_id="my-agent",
        ...     event_type="decision",
        ...     content={"action": "approved"}
        ... )
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.memstamp.io",
        timeout: float = 30.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client = httpx.Client(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
        )

    def stamp(
        self,
        agent_id: str,
        event_type: VCOTEventType,
        content: Any,
        framework: str = "memstamp-py/0.1",
        metadata: Optional[dict[str, Any]] = None,
    ) -> Stamp:
        """
        Create a new stamp for an agent event.
        
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
                "metadata": metadata,
            },
        )
        response.raise_for_status()
        return Stamp(**response.json())

    def verify(self, stamp_id: str) -> VerificationResult:
        """
        Verify a stamp against the blockchain.
        """
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
        limit: int = 100,
        offset: int = 0,
    ) -> list[Stamp]:
        """List stamps for an agent."""
        response = self._client.get(
            f"/v1/agents/{agent_id}/stamps",
            params={"limit": limit, "offset": offset},
        )
        response.raise_for_status()
        return [Stamp(**s) for s in response.json()["stamps"]]

    def _compute_hash(self, content: Any) -> str:
        """Compute SHA-256 hash with canonical JSON serialization."""
        canonical = json.dumps(content, sort_keys=True, separators=(",", ":"))
        hash_bytes = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        return f"sha256:{hash_bytes}"

    def close(self):
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
