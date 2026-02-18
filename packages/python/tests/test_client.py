"""Tests for the memstamp client."""

import pytest
from memstamp.client import MemstampClient


def test_compute_hash():
    """Test that content hashing produces consistent results."""
    client = MemstampClient(api_key="test", base_url="http://localhost:8010")
    
    hash1 = client._compute_hash({"a": 1, "b": 2})
    hash2 = client._compute_hash({"b": 2, "a": 1})
    
    assert hash1 == hash2
    assert hash1.startswith("sha256:")
    assert len(hash1) == 7 + 64  # "sha256:" + 64 hex chars


def test_hash_different_content():
    """Test that different content produces different hashes."""
    client = MemstampClient(api_key="test", base_url="http://localhost:8010")
    
    hash1 = client._compute_hash({"a": 1})
    hash2 = client._compute_hash({"a": 2})
    
    assert hash1 != hash2
