import { describe, it, expect } from 'vitest';
import { computeHash, canonicalJson, GENESIS_HASH } from '../src/hash';

describe('hash', () => {
  describe('computeHash', () => {
    it('should compute SHA-256 hash with sha256: prefix', () => {
      const hash = computeHash({ foo: 'bar' });
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should produce consistent hashes for same content', () => {
      const hash1 = computeHash({ a: 1, b: 2 });
      const hash2 = computeHash({ b: 2, a: 1 });
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const hash1 = computeHash({ a: 1 });
      const hash2 = computeHash({ a: 2 });
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('canonicalJson', () => {
    it('should sort object keys', () => {
      const result = canonicalJson({ z: 1, a: 2 });
      expect(result).toBe('{"a":2,"z":1}');
    });

    it('should handle nested objects', () => {
      const result = canonicalJson({ b: { z: 1, a: 2 }, a: 1 });
      expect(result).toBe('{"a":1,"b":{"a":2,"z":1}}');
    });

    it('should handle arrays without sorting', () => {
      const result = canonicalJson({ arr: [3, 1, 2] });
      expect(result).toBe('{"arr":[3,1,2]}');
    });
  });

  describe('GENESIS_HASH', () => {
    it('should be a valid sha256 hash of zeros', () => {
      expect(GENESIS_HASH).toMatch(/^sha256:0{64}$/);
    });
  });
});
