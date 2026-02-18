import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  signEventHash,
  verifySignature,
  computeHash,
} from '../src/index';

describe('Ed25519 Signing', () => {
  describe('generateKeyPair', () => {
    it('should generate keys of correct length', async () => {
      const keys = await generateKeyPair();
      // Ed25519 public key is 32 bytes = 64 hex chars
      expect(keys.publicKey).toHaveLength(64);
      // Ed25519 private key is 32 bytes = 64 hex chars
      expect(keys.privateKey).toHaveLength(64);
    });

    it('should generate different keys each time', async () => {
      const keys1 = await generateKeyPair();
      const keys2 = await generateKeyPair();
      expect(keys1.privateKey).not.toBe(keys2.privateKey);
      expect(keys1.publicKey).not.toBe(keys2.publicKey);
    });

    it('should generate hex-encoded keys', async () => {
      const keys = await generateKeyPair();
      expect(keys.publicKey).toMatch(/^[a-f0-9]{64}$/);
      expect(keys.privateKey).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('signEventHash', () => {
    it('should produce signature of correct length', async () => {
      const keys = await generateKeyPair();
      const hash = computeHash({ test: 'data' });
      const signature = await signEventHash(hash, keys.privateKey);
      // Ed25519 signature is 64 bytes = 128 hex chars
      expect(signature).toHaveLength(128);
    });

    it('should produce hex-encoded signature', async () => {
      const keys = await generateKeyPair();
      const hash = computeHash({ test: 'data' });
      const signature = await signEventHash(hash, keys.privateKey);
      expect(signature).toMatch(/^[a-f0-9]{128}$/);
    });

    it('should produce consistent signatures for same input', async () => {
      const keys = await generateKeyPair();
      const hash = computeHash({ test: 'data' });
      // Ed25519 is deterministic — same key+message = same signature
      const sig1 = await signEventHash(hash, keys.privateKey);
      const sig2 = await signEventHash(hash, keys.privateKey);
      expect(sig1).toBe(sig2);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', async () => {
      const keys = await generateKeyPair();
      const hash = computeHash({ test: 'data' });
      const signature = await signEventHash(hash, keys.privateKey);
      const valid = await verifySignature(
        hash,
        signature,
        keys.publicKey
      );
      expect(valid).toBe(true);
    });

    it('should reject wrong hash', async () => {
      const keys = await generateKeyPair();
      const hash = computeHash({ test: 'data' });
      const signature = await signEventHash(hash, keys.privateKey);
      const wrongHash = computeHash({ test: 'other' });
      const valid = await verifySignature(
        wrongHash,
        signature,
        keys.publicKey
      );
      expect(valid).toBe(false);
    });

    it('should reject wrong signature', async () => {
      const keys = await generateKeyPair();
      const hash = computeHash({ test: 'data' });
      const wrongSig = 'ff'.repeat(64);
      const valid = await verifySignature(
        hash,
        wrongSig,
        keys.publicKey
      );
      expect(valid).toBe(false);
    });

    it('should reject wrong public key', async () => {
      const keys1 = await generateKeyPair();
      const keys2 = await generateKeyPair();
      const hash = computeHash({ test: 'data' });
      const signature = await signEventHash(hash, keys1.privateKey);
      const valid = await verifySignature(
        hash,
        signature,
        keys2.publicKey
      );
      expect(valid).toBe(false);
    });

    it('should return false for malformed inputs', async () => {
      expect(
        await verifySignature('invalid', 'invalid', 'invalid')
      ).toBe(false);
      expect(
        await verifySignature('sha256:xyz', 'abc', 'def')
      ).toBe(false);
    });
  });
});
