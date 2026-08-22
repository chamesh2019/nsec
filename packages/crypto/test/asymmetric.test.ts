import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateUserKeyPair,
  generateRSAKeyPair,
  encryptProjectKeyForUser,
  decryptProjectKeyWithUserKey
} from '../src/asymmetric.js';
import { generateProjectKey } from '../src/symmetric.js';
import { DecryptionError } from '../src/errors.js';

describe('Asymmetric RSA-OAEP Key Sharing & User Keypairs', () => {
  it('generates a complete UserKeyPair with signing (Ed25519) and encryption (RSA-4096)', async () => {
    const userKeys = await generateUserKeyPair();

    assert.match(userKeys.signing.publicKey, /-----BEGIN PUBLIC KEY-----/);
    assert.match(userKeys.signing.privateKey, /-----BEGIN PRIVATE KEY-----/);
    assert.match(userKeys.encryption.publicKey, /-----BEGIN PUBLIC KEY-----/);
    assert.match(userKeys.encryption.privateKey, /-----BEGIN PRIVATE KEY-----/);
  });

  it('encrypts and decrypts ProjectKey across multiple users', async () => {
    const userA = await generateUserKeyPair();
    const userB = await generateUserKeyPair();
    const projectKey = generateProjectKey();

    // Encrypt ProjectKey for User A and User B
    const encForUserA = encryptProjectKeyForUser(projectKey, userA.encryption.publicKey);
    const encForUserB = encryptProjectKeyForUser(projectKey, userB.encryption.publicKey);

    assert.equal(encForUserA.algorithm, 'RSA-OAEP-4096');
    assert.notEqual(encForUserA.encryptedKey, encForUserB.encryptedKey);

    // Decrypt ProjectKey with each user's private key
    const decryptedA = decryptProjectKeyWithUserKey(encForUserA, userA.encryption.privateKey);
    const decryptedB = decryptProjectKeyWithUserKey(encForUserB, userB.encryption.privateKey);

    assert.equal(decryptedA, projectKey);
    assert.equal(decryptedB, projectKey);
  });

  it('fails to decrypt if wrong private key is used', async () => {
    const userA = await generateUserKeyPair();
    const userB = await generateUserKeyPair();
    const projectKey = generateProjectKey();

    const encForUserA = encryptProjectKeyForUser(projectKey, userA.encryption.publicKey);

    assert.throws(
      () => decryptProjectKeyWithUserKey(encForUserA, userB.encryption.privateKey),
      DecryptionError
    );
  });
});
