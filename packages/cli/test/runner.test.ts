import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runCommandWithSecrets } from '../src/runner.js';

describe('CLI Runner Engine', () => {
  it('spawns child process with injected secrets in process.env', async () => {
    // Run node script verifying presence of secret in memory
    const code = await runCommandWithSecrets(
      [process.execPath, '-e', 'if (process.env.TEST_SECRET !== "super_secret_value") process.exit(1);'],
      { TEST_SECRET: 'super_secret_value' }
    );
    assert.equal(code, 0);
  });

  it('propagates child process non-zero exit code', async () => {
    const code = await runCommandWithSecrets(
      [process.execPath, '-e', 'process.exit(42);'],
      {}
    );
    assert.equal(code, 42);
  });
});
