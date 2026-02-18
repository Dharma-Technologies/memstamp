/**
 * VCOT Event Types
 * The Verifiable Chain of Thought schema standard
 */

export const VCOT_VERSION = 'vcot/0.1' as const;

export type VCOTEventType =
  | 'decision'
  | 'tool_call'
  | 'tool_result'
  | 'memory_write'
  | 'memory_read'
  | 'external_action'
  | 'state_change'
  | 'observation'
  | 'custom';

export interface VCOTEvent {
  version: typeof VCOT_VERSION;
  event_id: string;
  event_type: VCOTEventType;
  timestamp: string;
  agent_id: string;
  content_hash: string;
  previous_hash: string;
  framework: string;
  signature: string;
  metadata?: Record<string, unknown>;
}

export interface VCOTEventInput {
  event_type: VCOTEventType;
  agent_id: string;
  content: unknown;
  framework?: string;
  metadata?: Record<string, unknown>;
}

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
}

export interface MerkleProof {
  leaf: string;
  proof: Array<{
    hash: string;
    position: 'left' | 'right';
  }>;
  root: string;
}

export interface AnchorRecord {
  id: string;
  merkle_root: string;
  event_count: number;
  time_range: {
    start: string;
    end: string;
  };
  chain: string;
  tx_hash: string;
  block_number?: number;
  status: 'pending' | 'confirmed' | 'finalized';
  created_at: string;
}

export interface VerificationResult {
  verified: boolean;
  event_id: string;
  content_hash: string;
  merkle_root: string;
  anchor?: AnchorRecord;
  chain_verified: boolean;
  signature_verified: boolean;
  hash_chain_valid: boolean;
  error?: string;
}
