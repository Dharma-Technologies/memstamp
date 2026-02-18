"""
memstamp type definitions — VCOT schema types
"""

from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

VCOTEventType = Literal[
    "decision",
    "tool_call",
    "tool_result",
    "memory_write",
    "memory_read",
    "external_action",
    "state_change",
    "observation",
    "custom",
]


class VCOTEvent(BaseModel):
    """VCOT Event schema"""
    version: str = "vcot/0.1"
    event_id: str
    event_type: VCOTEventType
    timestamp: datetime
    agent_id: str
    content_hash: str
    previous_hash: str
    framework: str
    signature: str
    metadata: Optional[dict[str, Any]] = None


class Stamp(BaseModel):
    """A memstamp stamp record"""
    id: str
    event_id: str
    content_hash: str
    previous_hash: str
    agent_id: str
    event_type: VCOTEventType
    status: Literal["pending", "anchored", "verified"]
    chain: Optional[str] = None
    anchor_id: Optional[str] = None
    merkle_proof: Optional[dict[str, Any]] = None
    created_at: datetime
    anchored_at: Optional[datetime] = None


class VerificationResult(BaseModel):
    """Result of verifying a stamp"""
    verified: bool
    stamp_id: str
    content_hash: str
    merkle_root: Optional[str] = None
    anchor_tx: Optional[str] = None
    chain: Optional[str] = None
    block_number: Optional[int] = None
    chain_verified: bool = False
    signature_verified: bool = False
    hash_chain_valid: bool = False
    error: Optional[str] = None


class AnchorRecord(BaseModel):
    """A blockchain anchor record"""
    id: str
    merkle_root: str
    event_count: int
    start_time: datetime
    end_time: datetime
    chain: str
    tx_hash: str
    block_number: Optional[int] = None
    status: Literal["pending", "confirmed", "finalized"]
    created_at: datetime
