import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/index.js';

describe('@nsec/core exports', () => {
  it('exports schemas, config loaders, client, and errors', () => {
    assert.ok(core.ZVaultConfigSchema);
    assert.ok(core.loadConfig);
    assert.ok(core.ZVaultApiClient);
    assert.ok(core.ZVaultError);
    assert.equal(core.CORE_VERSION, '0.1.0');
  });
});
