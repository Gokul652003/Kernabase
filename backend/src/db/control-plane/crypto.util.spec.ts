import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret } from '@/db/control-plane/crypto.util';

const SECRET = 'unit-test-encryption-secret';

test('a project password survives a round trip', () => {
  const password = 'p@ssw0rd with spaces and ünicode';
  assert.equal(decryptSecret(encryptSecret(password, SECRET), SECRET), password);
});

test('the same plaintext encrypts differently every time', () => {
  assert.notEqual(encryptSecret('same', SECRET), encryptSecret('same', SECRET), 'the IV must be random');
});

test('decrypting with the wrong secret fails instead of returning garbage', () => {
  const payload = encryptSecret('secret-value', SECRET);
  assert.throws(() => decryptSecret(payload, 'a-different-secret'));
});

test('a tampered payload is rejected by the auth tag', () => {
  const payload = Buffer.from(encryptSecret('secret-value', SECRET), 'base64');
  payload[payload.length - 1] = (payload[payload.length - 1] ?? 0) ^ 0xff;
  assert.throws(() => decryptSecret(payload.toString('base64'), SECRET));
});
