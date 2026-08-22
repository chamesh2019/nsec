import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { executeInit, executeSet, executeGet } from '../src/commands/index.js';
import { createCredentialStore } from '@zvault/keyring';

describe('CLI Helper Commands', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zvault-cli-cmd-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('executes init and generates valid zvault.config.json', async () => {
    const res = await executeInit({
      project: 'test-init-service',
      storage: 'memory',
      cwd: tempDir
    });

    assert.equal(res.project, 'test-init-service');
    const configPath = path.join(tempDir, 'zvault.config.json');
    const content = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    assert.equal(content.project, 'test-init-service');
    assert.equal(content.defaultEnvironment, 'development');
  });
});
