import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CryptoError,
  DecryptionError,
  SignatureVerificationError,
  InvalidKeyError
} from '../src/errors.js';

describe('Crypto Errors', () => {
  it('DecryptionError inherits from CryptoError and contains helpful message', () => {
    const err = new DecryptionError('Authentication tag mismatch or corrupted ciphertext');
    assert.equal(err.name, 'DecryptionError');
    assert.match(err.message, /Authentication tag mismatch/);
    assert.ok(err instanceof CryptoError);
  });

  it('SignatureVerificationError includes verification context', () => {
    const err = new SignatureVerificationError('Invalid Ed25519 signature');
    assert.equal(err.name, 'SignatureVerificationError');
    assert.ok(err instanceof CryptoError);
  });

  it('InvalidKeyError indicates key format problems', () => {
    const err = new InvalidKeyError('Expected 256-bit AES key');
    assert.equal(err.name, 'InvalidKeyError');
    assert.ok(err instanceof CryptoError);
  });
});
