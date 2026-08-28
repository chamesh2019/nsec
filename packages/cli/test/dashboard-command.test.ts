import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, MemoryDatabaseAdapter } from '@nsec/server';
import { createCredentialStore } from '@nsec/keyring';
import { executeRegister } from '../src/commands/register.js';
import { executeDashboard } from '../src/commands/dashboard.js';

describe('CLI executeDashboard Command', () => {
  let app: any;
  let serverUrl: string;

  before(async () => {
    const db = new MemoryDatabaseAdapter();
    app = await createServer({ db });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    serverUrl = address;
  });

  after(async () => {
    await app.close();
  });

  it('generates a valid authenticated dashboard URL with hash-based login ticket', async () => {
    const store = await createCredentialStore({ mode: 'memory' });

    // Register admin user
    await executeRegister('admin@company.com', {
      serverUrl,
      credentialStore: store
    });

    const res = await executeDashboard({
      serverUrl,
      credentialStore: store,
      noOpen: true
    });

    assert.equal(res.email, 'admin@company.com');
    assert.equal(res.serverUrl, serverUrl);
    assert.match(res.dashboardUrl, /\/dashboard#auth=/);

    // Extract ticket and exchange with server
    const ticket = res.dashboardUrl.split('#auth=')[1];
    assert.ok(ticket);

    const exchangeRes = await fetch(`${serverUrl}/api/v1/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: decodeURIComponent(ticket) })
    });

    assert.equal(exchangeRes.status, 200);
    const sessionData = await exchangeRes.json();
    assert.equal(sessionData.user.email, 'admin@company.com');
    assert.equal(sessionData.user.role, 'admin');
    assert.ok(sessionData.token.startsWith('ns_sess_'));
  });
});
