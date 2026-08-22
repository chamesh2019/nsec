import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  KeyringError,
  KeyringUnavailableError,
  CredentialsNotFoundError,
  InvalidCredentialsError
} from '../src/errors.js';

describe('Keyring Errors', () => {
  it('KeyringUnavailableError has descriptive message and correct name', () => {
    const err = new KeyringUnavailableError('OS Keyring daemon unreachable');
    assert.equal(err.name, 'KeyringUnavailableError');
    assert.match(err.message, /OS Keyring daemon unreachable/);
    assert.ok(err instanceof KeyringError);
  });

  it('CredentialsNotFoundError includes account name', () => {
    const err = new CredentialsNotFoundError('project-123');
    assert.equal(err.name, 'CredentialsNotFoundError');
    assert.match(err.message, /project-123/);
    assert.ok(err instanceof KeyringError);
  });

  it('InvalidCredentialsError includes reason', () => {
    const err = new InvalidCredentialsError('Missing required field: privateKey');
    assert.equal(err.name, 'InvalidCredentialsError');
    assert.match(err.message, /Missing required field: privateKey/);
  });
});
