// Merkle tree implementation

import { createHash } from 'crypto';
import type { MerkleNode, MerkleProof } from './types';

/**
 * Build a Merkle tree from leaf hashes
 */
export function buildMerkleTree(leaves: string[]): MerkleNode | null {
  if (leaves.length === 0) return null;

  // Create leaf nodes
  let nodes: MerkleNode[] = leaves.map((hash) => ({ hash }));

  // Build tree bottom-up
  while (nodes.length > 1) {
    const nextLevel: MerkleNode[] = [];

    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1] ?? left; // Duplicate if odd

      const combinedHash = hashPair(left.hash, right.hash);
      nextLevel.push({
        hash: combinedHash,
        left,
        right: nodes[i + 1] ? right : undefined,
      });
    }

    nodes = nextLevel;
  }

  return nodes[0];
}

/**
 * Compute Merkle root from leaves
 */
export function computeMerkleRoot(leaves: string[]): string {
  const tree = buildMerkleTree(leaves);
  return tree?.hash ?? '';
}

/**
 * Generate proof for a leaf in the tree
 */
export function generateMerkleProof(
  leaves: string[],
  leafIndex: number
): MerkleProof | null {
  if (leafIndex < 0 || leafIndex >= leaves.length) return null;

  const proof: MerkleProof['proof'] = [];
  let currentIndex = leafIndex;
  let currentLevel = [...leaves];

  while (currentLevel.length > 1) {
    const isRightNode = currentIndex % 2 === 1;
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

    // When sibling doesn't exist (odd count), use self (duplication)
    const siblingHash =
      siblingIndex < currentLevel.length
        ? currentLevel[siblingIndex]
        : currentLevel[currentIndex];
    proof.push({
      hash: siblingHash,
      position: isRightNode ? 'left' : 'right',
    });

    // Move to parent level
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] ?? left;
      nextLevel.push(hashPair(left, right));
    }

    currentIndex = Math.floor(currentIndex / 2);
    currentLevel = nextLevel;
  }

  return {
    leaf: leaves[leafIndex],
    proof,
    root: currentLevel[0],
  };
}

/**
 * Verify a Merkle proof
 */
export function verifyMerkleProof(proof: MerkleProof): boolean {
  let currentHash = proof.leaf;

  for (const step of proof.proof) {
    currentHash =
      step.position === 'left'
        ? hashPair(step.hash, currentHash)
        : hashPair(currentHash, step.hash);
  }

  return currentHash === proof.root;
}

/**
 * Hash two nodes together
 */
function hashPair(left: string, right: string): string {
  // Remove sha256: prefix for hashing, then re-add
  const leftHex = left.replace('sha256:', '');
  const rightHex = right.replace('sha256:', '');
  const combined = leftHex + rightHex;
  const hash = createHash('sha256').update(combined, 'hex').digest('hex');
  return `sha256:${hash}`;
}
