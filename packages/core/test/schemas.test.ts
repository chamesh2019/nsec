import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ZVaultConfigSchema,
  EncryptedSecretsPayloadSchema,
  ProjectSchema,
  ServiceTokenSchema
} from '../src/schemas/index.js';
import { ValidationError, ConfigError } from '../src/errors.js';

describe('Core Zod Schemas', () => {
  it('validates a correct zvault configuration', () => {
    const validConfig = {
      project: 'my-web-app',
      defaultEnvironment: 'development',
      serverUrl: 'https://vault.example.com',
      environments: ['development', 'staging', 'production', 'ci']
    };
    const parsed = ZVaultConfigSchema.parse(validConfig);
    assert.equal(parsed.project, 'my-web-app');
    assert.equal(parsed.defaultEnvironment, 'development');
    assert.deepEqual(parsed.environments, ['development', 'staging', 'production', 'ci']);
  });

  it('rejects invalid project names', () => {
    assert.throws(
      () => ZVaultConfigSchema.parse({ project: 'INVALID PROJECT NAME WITH SPACES' }),
      /Project name must/
    );
  });

  it('validates encrypted secrets payload schema', () => {
    const validPayload = {
      ciphertext: 'YWVzX2NpcGhlcnRleHQ=',
      iv: 'MTIzNDU2Nzg5MDEy',
      tag: 'MTIzNDU2Nzg5MDEyMzQ1Ng==',
      version: 1
    };
    const parsed = EncryptedSecretsPayloadSchema.parse(validPayload);
    assert.equal(parsed.version, 1);
  });

  it('validates service token schema', () => {
    const tokenData = {
      id: 'st_123',
      projectId: 'my-web-app',
      environment: 'ci',
      name: 'GitHub Actions Deploy Token',
      createdAt: new Date().toISOString()
    };
    const parsed = ServiceTokenSchema.parse(tokenData);
    assert.equal(parsed.environment, 'ci');
  });
});
