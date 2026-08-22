import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, resolveEnvOverrides } from '../src/config/index.js';

describe('Config Loader & Env Resolution', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zvault-config-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.ZVAULT_PROJECT;
    delete process.env.ZVAULT_ENV;
    delete process.env.ZVAULT_SERVER_URL;
  });

  it('loads config from zvault.config.json', async () => {
    const configPath = path.join(tempDir, 'zvault.config.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        project: 'test-service',
        defaultEnvironment: 'staging',
        serverUrl: 'https://custom-vault.dev'
      })
    );

    const config = await loadConfig(tempDir);
    assert.equal(config.project, 'test-service');
    assert.equal(config.defaultEnvironment, 'staging');
    assert.equal(config.serverUrl, 'https://custom-vault.dev');
  });

  it('overrides config with environment variables', async () => {
    process.env.ZVAULT_PROJECT = 'env-override-proj';
    process.env.ZVAULT_ENV = 'production';
    process.env.ZVAULT_SERVER_URL = 'https://prod-vault.dev';

    const overrides = resolveEnvOverrides();
    assert.equal(overrides.project, 'env-override-proj');
    assert.equal(overrides.defaultEnvironment, 'production');
    assert.equal(overrides.serverUrl, 'https://prod-vault.dev');

    const config = await loadConfig(tempDir, overrides);
    assert.equal(config.project, 'env-override-proj');
  });
});
