// Ed25519 signing for framework signatures
// Placeholder - implementation in P11-01

import * as ed from '@noble/ed25519';

/**
 * Generate a new Ed25519 key pair
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  return {
    publicKey: Buffer.from(publicKey).toString('hex'),
    privateKey: Buffer.from(privateKey).toString('hex'),
  };
}

/**
 * Sign an event hash with a private key
 */
export async function signEventHash(
  eventHash: string,
  privateKey: string
): Promise<string> {
  const hashBytes = hexToBytes(eventHash.replace('sha256:', ''));
  const keyBytes = hexToBytes(privateKey);

  const signature = await ed.signAsync(hashBytes, keyBytes);
  return Buffer.from(signature).toString('hex');
}

/**
 * Verify a signature against an event hash and public key
 */
export async function verifySignature(
  eventHash: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    const hashBytes = hexToBytes(eventHash.replace('sha256:', ''));
    const sigBytes = hexToBytes(signature);
    const keyBytes = hexToBytes(publicKey);

    return await ed.verifyAsync(sigBytes, hashBytes, keyBytes);
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}
