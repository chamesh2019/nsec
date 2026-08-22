import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateEd25519KeyPair } from '../src/asymmetric.js';
import { signPayload, verifySignature } from '../src/signatures.js';
import { SignatureVerificationError } from '../src/errors.js';

describe('Ed25519 Digital Signatures', () => {
  it('signs and verifies payload successfully', async () => {
    const { publicKey, privateKey } = await generateEd25519KeyPair();
    const payload = { action: 'fetch_secrets', project: 'proj_alpha', env: 'prod' };

    const signed = signPayload(payload, privateKey, publicKey);
    assert.equal(typeof signed.signature, 'string');
    assert.deepEqual(signed.payload, payload);

    const isValid = verifySignature(signed);
    assert.equal(isValid, true);
  });

  it('rejects tampered payload', async () => {
    const { publicKey, privateKey } = await generateEd25519KeyPair();
    const payload = { action: 'fetch_secrets', project: 'proj_alpha' };

    const signed = signPayload(payload, privateKey, publicKey);
    // Tamper with payload
    const tampered = {
      ...signed,
      payload: { ...payload, project: 'proj_beta' }
    };

    assert.equal(verifySignature(tampered), false);
  });

  it('rejects signature from a different keypair', async () => {
    const userA = await generateEd25519KeyPair();
    const userB = await generateEd25519KeyPair();

    const signed = signPayload({ test: 123 }, userA.privateKey, userA.publicKey);
    // Replace public key with user B
    const spoofed = { ...signed, publicKey: userB.publicKey };

    assert.equal(verifySignature(spoofed), false);
  });
});
