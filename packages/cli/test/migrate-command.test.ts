import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { executeMigrate } from '../src/commands/migrate.js';
import { createCredentialStore } from '@nsec/keyring';
import type { NullSecConfig } from '@nsec/core';

async function writeConfig(cwd: string, partial: Partial<NullSecConfig> = {}) {
  const config = {
    project: 'migrate-test',
    defaultEnvironment: 'development',
    serverUrl: 'http://localhost:4000',
    environments: ['development', 'staging', 'production'],
    storage: 'memory',
    ...partial
  };
  await fs.writeFile(
    path.join(cwd, 'nullsec.config.json'),
    JSON.stringify(config, null, 2),
    'utf-8'
  );
}

describe('executeMigrate', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zvault-migrate-test-'));
    await writeConfig(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('uploads every secret and overwrites values with [REDACTED]', async () => {
    const envPath = path.join(tempDir, '.env');
    const original = [
      '# Database config',
      'DATABASE_URL="postgres://user:secret@host/db"',
      'API_KEY=plain-key-123',
      "SESSION_SECRET='s3cr3t with spaces'",
      ''
    ].join('\n');
    await fs.writeFile(envPath, original, 'utf-8');

    const uploaded: Array<{ key: string; value: string }> = [];
    const credentialStore = await createCredentialStore({ mode: 'memory' });

    const res = await executeMigrate({
      file: envPath,
      credentialStore,
      cwd: tempDir,
      uploader: async (key, value) => {
        uploaded.push({ key, value });
      }
    });

    assert.equal(res.uploaded.length, 3);
    assert.deepEqual(
      res.uploaded.sort(),
      ['API_KEY', 'DATABASE_URL', 'SESSION_SECRET'].sort()
    );
    assert.equal(res.redactedCount, 3);

    // The uploader saw every key with its original value.
    assert.deepEqual(
      uploaded.map((u) => u.key).sort(),
      ['API_KEY', 'DATABASE_URL', 'SESSION_SECRET'].sort()
    );
    const byKey = Object.fromEntries(uploaded.map((u) => [u.key, u.value]));
    assert.equal(byKey.DATABASE_URL, 'postgres://user:secret@host/db');
    assert.equal(byKey.API_KEY, 'plain-key-123');
    assert.equal(byKey.SESSION_SECRET, 's3cr3t with spaces');

    // File on disk now has [REDACTED] in place of the plaintext values.
    const after = await fs.readFile(envPath, 'utf-8');
    assert.match(after, /DATABASE_URL="\[REDACTED\]"/);
    assert.match(after, /API_KEY=\[REDACTED\]/);
    assert.match(after, /SESSION_SECRET='\[REDACTED\]'/);
    // Comment and trailing newline preserved.
    assert.match(after, /^# Database config/m);
    assert.equal(after.endsWith('\n'), true);
    // Plaintext values are gone.
    assert.equal(after.includes('plain-key-123'), false);
    assert.equal(after.includes('s3cr3t with spaces'), false);
  });

  it('leaves the file untouched if the uploader throws mid-batch', async () => {
    const envPath = path.join(tempDir, '.env');
    const original = 'KEY1=one\nKEY2=two\nKEY3=three\n';
    await fs.writeFile(envPath, original, 'utf-8');

    const credentialStore = await createCredentialStore({ mode: 'memory' });

    await assert.rejects(
      executeMigrate({
        file: envPath,
        credentialStore,
        cwd: tempDir,
        uploader: async (key) => {
          if (key === 'KEY2') throw new Error('simulated upload failure');
        }
      }),
      /simulated upload failure/
    );

    // KEY3 was never attempted; nothing in the file is redacted.
    const after = await fs.readFile(envPath, 'utf-8');
    assert.equal(after, original);
  });

  it('reports the parsed entries in dry-run mode and does not touch the file', async () => {
    const envPath = path.join(tempDir, '.env');
    const original = 'FOO=1\nBAR=2\n';
    await fs.writeFile(envPath, original, 'utf-8');

    let called = false;
    const credentialStore = await createCredentialStore({ mode: 'memory' });

    const res = await executeMigrate({
      file: envPath,
      credentialStore,
      cwd: tempDir,
      dryRun: true,
      uploader: async () => {
        called = true;
      }
    });

    assert.equal(called, false);
    assert.equal(res.dryRun, true);
    assert.deepEqual(res.uploaded.sort(), ['BAR', 'FOO']);
    assert.equal(res.redactedCount, 0);

    const after = await fs.readFile(envPath, 'utf-8');
    assert.equal(after, original);
  });

  it('skips empty values without calling the uploader', async () => {
    const envPath = path.join(tempDir, '.env');
    await fs.writeFile(envPath, 'EMPTY=\nREAL=value\n', 'utf-8');

    const uploaded: string[] = [];
    const credentialStore = await createCredentialStore({ mode: 'memory' });

    const res = await executeMigrate({
      file: envPath,
      credentialStore,
      cwd: tempDir,
      uploader: async (key) => {
        uploaded.push(key);
      }
    });

    assert.deepEqual(uploaded, ['REAL']);
    assert.equal(res.uploaded.length, 1);
    assert.equal(res.skipped.length, 1);
    assert.equal(res.skipped[0].key, 'EMPTY');

    const after = await fs.readFile(envPath, 'utf-8');
    // EMPTY is not in `uploaded`, so its line stays as-is.
    assert.match(after, /^EMPTY=$/m);
    assert.match(after, /^REAL=\[REDACTED\]$/m);
  });
});
