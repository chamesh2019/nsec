import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateProjectKey,
  encryptProjectSecrets,
  decryptProjectSecrets
} from '../src/symmetric.js';
import { DecryptionError, InvalidKeyError } from '../src/errors.js';

describe('Symmetric AES-256-GCM Encryption', () => {
  it('generates a valid 256-bit base64 project key', () => {
    const key = generateProjectKey();
    assert.equal(typeof key, 'string');
    const buffer = Buffer.from(key, 'base64');
    assert.equal(buffer.length, 32, 'Project key must be exactly 32 bytes (256 bits)');
  });

  it('encrypts and decrypts secret dictionary roundtrip', () => {
    const key = generateProjectKey();
    const secrets = {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      STRIPE_SECRET_KEY: 'sk_test_1234567890',
      NODE_ENV: 'production'
    };

    const encrypted = encryptProjectSecrets(secrets, key);
    assert.equal(typeof encrypted.ciphertext, 'string');
    assert.equal(typeof encrypted.iv, 'string');
    assert.equal(typeof encrypted.tag, 'string');
    assert.equal(encrypted.version, 1);

    const decrypted = decryptProjectSecrets(encrypted, key);
    assert.deepEqual(decrypted, secrets);
  });

  it('throws DecryptionError when ciphertext or tag is tampered with', () => {
    const key = generateProjectKey();
    const encrypted = encryptProjectSecrets({ FOO: 'BAR' }, key);

    // Tamper with tag
    const corruptedTag = {
      ...encrypted,
      tag: Buffer.from('corrupted_tag_123').toString('base64')
    };
    assert.throws(() => decryptProjectSecrets(corruptedTag, key), DecryptionError);

    // Tamper with wrong key
    const wrongKey = generateProjectKey();
    assert.throws(() => decryptProjectSecrets(encrypted, wrongKey), DecryptionError);
  });

  it('validates key format', () => {
    assert.throws(() => encryptProjectSecrets({ A: 'B' }, 'short_invalid_key'), InvalidKeyError);
  });
});
