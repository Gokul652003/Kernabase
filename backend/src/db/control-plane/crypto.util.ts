import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(secret: string): Buffer {
  return scryptSync(secret, 'mydb-studio-salt', 32);
}

// Project DB passwords must be recoverable (we need the plaintext to open real
// connections), so they're encrypted at rest rather than hashed.
export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string, secret: string): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  if (buf.length < 29) throw new Error('Invalid encrypted secret');
  const decipher = createDecipheriv(ALGO, getKey(secret), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
