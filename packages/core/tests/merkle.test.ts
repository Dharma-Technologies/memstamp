import { describe, it, expect } from 'vitest';
import {
  buildMerkleTree,
  computeMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  computeHash,
} from '../src/index';

function makeLeaves(count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    computeHash({ index: i })
  );
}

describe('Merkle Tree', () => {
  describe('buildMerkleTree', () => {
    it('should return null for empty array', () => {
      expect(buildMerkleTree([])).toBeNull();
    });

    it('should return single node for one leaf', () => {
      const leaves = makeLeaves(1);
      const tree = buildMerkleTree(leaves);
      expect(tree).not.toBeNull();
      expect(tree!.hash).toBe(leaves[0]);
      expect(tree!.left).toBeUndefined();
      expect(tree!.right).toBeUndefined();
    });

    it('should build tree from two leaves', () => {
      const leaves = makeLeaves(2);
      const tree = buildMerkleTree(leaves);
      expect(tree).not.toBeNull();
      expect(tree!.left).toBeDefined();
      expect(tree!.right).toBeDefined();
      expect(tree!.left!.hash).toBe(leaves[0]);
      expect(tree!.right!.hash).toBe(leaves[1]);
    });

    it('should handle odd number of leaves by duplicating last', () => {
      const leaves = makeLeaves(3);
      const tree = buildMerkleTree(leaves);
      expect(tree).not.toBeNull();
      // Root should have two children
      expect(tree!.left).toBeDefined();
      expect(tree!.right).toBeDefined();
    });

    it('should build tree from power-of-2 leaves', () => {
      const leaves = makeLeaves(8);
      const tree = buildMerkleTree(leaves);
      expect(tree).not.toBeNull();
      expect(tree!.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });
  });

  describe('computeMerkleRoot', () => {
    it('should return empty string for empty array', () => {
      expect(computeMerkleRoot([])).toBe('');
    });

    it('should return the leaf itself for single element', () => {
      const leaves = makeLeaves(1);
      expect(computeMerkleRoot(leaves)).toBe(leaves[0]);
    });

    it('should compute consistent root for same leaves', () => {
      const leaves = makeLeaves(5);
      const root1 = computeMerkleRoot(leaves);
      const root2 = computeMerkleRoot(leaves);
      expect(root1).toBe(root2);
    });

    it('should produce different roots for different leaves', () => {
      const leaves1 = makeLeaves(4);
      const leaves2 = [
        ...leaves1.slice(0, 3),
        computeHash({ index: 999 }),
      ];
      expect(computeMerkleRoot(leaves1)).not.toBe(
        computeMerkleRoot(leaves2)
      );
    });

    it('should handle large arrays (1000+ elements)', () => {
      const leaves = makeLeaves(1024);
      const root = computeMerkleRoot(leaves);
      expect(root).toMatch(/^sha256:[a-f0-9]{64}$/);
    });
  });

  describe('generateMerkleProof', () => {
    it('should return null for negative index', () => {
      expect(generateMerkleProof(makeLeaves(3), -1)).toBeNull();
    });

    it('should return null for out-of-bounds index', () => {
      const leaves = makeLeaves(3);
      expect(generateMerkleProof(leaves, 3)).toBeNull();
    });

    it('should generate proof for single-element tree', () => {
      const leaves = makeLeaves(1);
      const proof = generateMerkleProof(leaves, 0);
      expect(proof).not.toBeNull();
      expect(proof!.leaf).toBe(leaves[0]);
      expect(proof!.root).toBe(leaves[0]);
      expect(proof!.proof).toHaveLength(0);
    });

    it('should generate proof for first leaf', () => {
      const leaves = makeLeaves(4);
      const proof = generateMerkleProof(leaves, 0);
      expect(proof).not.toBeNull();
      expect(proof!.leaf).toBe(leaves[0]);
      expect(proof!.root).toBe(computeMerkleRoot(leaves));
    });

    it('should generate proof for middle leaf', () => {
      const leaves = makeLeaves(4);
      const proof = generateMerkleProof(leaves, 2);
      expect(proof).not.toBeNull();
      expect(proof!.leaf).toBe(leaves[2]);
      expect(proof!.root).toBe(computeMerkleRoot(leaves));
    });

    it('should generate proof for last leaf', () => {
      const leaves = makeLeaves(4);
      const proof = generateMerkleProof(leaves, 3);
      expect(proof).not.toBeNull();
      expect(proof!.leaf).toBe(leaves[3]);
      expect(proof!.root).toBe(computeMerkleRoot(leaves));
    });

    it('should generate proof for odd-numbered tree', () => {
      const leaves = makeLeaves(5);
      const proof = generateMerkleProof(leaves, 4);
      expect(proof).not.toBeNull();
      expect(proof!.root).toBe(computeMerkleRoot(leaves));
    });
  });

  describe('verifyMerkleProof', () => {
    it('should verify valid proof', () => {
      const leaves = makeLeaves(8);
      for (let i = 0; i < leaves.length; i++) {
        const proof = generateMerkleProof(leaves, i)!;
        expect(verifyMerkleProof(proof)).toBe(true);
      }
    });

    it('should reject tampered leaf', () => {
      const leaves = makeLeaves(4);
      const proof = generateMerkleProof(leaves, 1)!;
      proof.leaf = computeHash({ tampered: true });
      expect(verifyMerkleProof(proof)).toBe(false);
    });

    it('should reject tampered proof step', () => {
      const leaves = makeLeaves(4);
      const proof = generateMerkleProof(leaves, 0)!;
      proof.proof[0].hash = computeHash({ tampered: true });
      expect(verifyMerkleProof(proof)).toBe(false);
    });

    it('should reject tampered root', () => {
      const leaves = makeLeaves(4);
      const proof = generateMerkleProof(leaves, 0)!;
      proof.root = computeHash({ tampered: true });
      expect(verifyMerkleProof(proof)).toBe(false);
    });

    it('should reject wrong position', () => {
      const leaves = makeLeaves(4);
      const proof = generateMerkleProof(leaves, 0)!;
      proof.proof[0].position =
        proof.proof[0].position === 'left' ? 'right' : 'left';
      expect(verifyMerkleProof(proof)).toBe(false);
    });

    it('should verify proof for single-element tree', () => {
      const leaves = makeLeaves(1);
      const proof = generateMerkleProof(leaves, 0)!;
      expect(verifyMerkleProof(proof)).toBe(true);
    });
  });
});
