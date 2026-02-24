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

    it('should serialize null', () => {
      expect(canonicalJson(null)).toBe('null');
    });

    it('should serialize booleans', () => {
      expect(canonicalJson(true)).toBe('true');
      expect(canonicalJson(false)).toBe('false');
    });

    it('should serialize strings with NFC normalization', () => {
      const decomposed = '\u0041\u030A';
      const composed = '\u00C5';
      expect(canonicalJson(decomposed)).toBe(canonicalJson(composed));
    });

    it('should escape required characters in strings', () => {
      expect(canonicalJson('hello\nworld')).toBe('"hello\\nworld"');
      expect(canonicalJson('tab\there')).toBe('"tab\\there"');
      expect(canonicalJson('back\\slash')).toBe('"back\\\\slash"');
      expect(canonicalJson('quote"mark')).toBe('"quote\\"mark"');
      expect(canonicalJson('\b\f\r')).toBe('"\\b\\f\\r"');
    });

    it('should escape control characters as \\uXXXX', () => {
      expect(canonicalJson('\x00')).toBe('"\\u0000"');
      expect(canonicalJson('\x01')).toBe('"\\u0001"');
      expect(canonicalJson('\x1f')).toBe('"\\u001f"');
    });

    it('should not escape non-required characters', () => {
      expect(canonicalJson('/')).toBe('"/"');
      expect(canonicalJson('émoji')).toBe('"émoji"');
    });

    it('should handle negative zero as 0', () => {
      expect(canonicalJson(-0)).toBe('0');
      expect(canonicalJson(0)).toBe('0');
    });

    it('should serialize integers without scientific notation', () => {
      expect(canonicalJson(1)).toBe('1');
      expect(canonicalJson(-42)).toBe('-42');
      expect(canonicalJson(0)).toBe('0');
    });

    it('should serialize floating point numbers correctly', () => {
      expect(canonicalJson(1.5)).toBe('1.5');
      expect(canonicalJson(0.1)).toBe('0.1');
      expect(canonicalJson(-0.5)).toBe('-0.5');
    });

    it('should serialize large numbers correctly', () => {
      expect(canonicalJson(1e20)).toBe('100000000000000000000');
      expect(canonicalJson(1e21)).toBe('1e+21');
    });

    it('should throw on NaN', () => {
      expect(() => canonicalJson(NaN)).toThrow(
        'NaN is not allowed in canonical JSON'
      );
    });

    it('should throw on Infinity', () => {
      expect(() => canonicalJson(Infinity)).toThrow(
        'Infinity is not allowed in canonical JSON'
      );
      expect(() => canonicalJson(-Infinity)).toThrow(
        'Infinity is not allowed in canonical JSON'
      );
    });

    it('should throw on BigInt', () => {
      expect(() => canonicalJson(BigInt(42))).toThrow(
        'BigInt values cannot be serialized to canonical JSON'
      );
    });

    it('should drop undefined values from objects', () => {
      const result = canonicalJson({ a: 1, b: undefined, c: 3 });
      expect(result).toBe('{"a":1,"c":3}');
    });

    it('should serialize undefined as null in arrays', () => {
      const result = canonicalJson([1, undefined, 3]);
      expect(result).toBe('[1,null,3]');
    });

    it('should handle null values in objects', () => {
      const result = canonicalJson({ a: null, b: 1 });
      expect(result).toBe('{"a":null,"b":1}');
    });

    it('should handle empty objects and arrays', () => {
      expect(canonicalJson({})).toBe('{}');
      expect(canonicalJson([])).toBe('[]');
    });

    it('should handle deeply nested structures', () => {
      const deep = { a: { b: { c: { d: 1 } } } };
      expect(canonicalJson(deep)).toBe('{"a":{"b":{"c":{"d":1}}}}');
    });

    it('should handle arrays of objects with sorted keys', () => {
      const result = canonicalJson([
        { z: 1, a: 2 },
        { b: 3, a: 4 },
      ]);
      expect(result).toBe('[{"a":2,"z":1},{"a":4,"b":3}]');
    });

    it('should handle mixed-type arrays', () => {
      const result = canonicalJson([1, 'two', true, null, { a: 3 }]);
      expect(result).toBe('[1,"two",true,null,{"a":3}]');
    });

    it('should handle unicode strings correctly', () => {
      expect(canonicalJson('こんにちは')).toBe('"こんにちは"');
      expect(canonicalJson('🎉')).toBe('"🎉"');
    });

    it('should sort keys by UTF-16 code units', () => {
      const result = canonicalJson({ '\u00e9': 1, e: 2, E: 3 });
      expect(result).toBe('{"E":3,"e":2,"é":1}');
    });

    it('should drop function values from objects', () => {
      const result = canonicalJson({ a: 1, b: () => {}, c: 3 });
      expect(result).toBe('{"a":1,"c":3}');
    });

    it('should drop symbol values from objects', () => {
      const result = canonicalJson({ a: 1, b: Symbol('test'), c: 3 });
      expect(result).toBe('{"a":1,"c":3}');
    });
  });

  describe('GENESIS_HASH', () => {
    it('should be a valid sha256 hash of zeros', () => {
      expect(GENESIS_HASH).toMatch(/^sha256:0{64}$/);
    });
  });
});
