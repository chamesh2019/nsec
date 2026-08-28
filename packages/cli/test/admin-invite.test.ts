import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHonoServer, MemoryDatabaseAdapter, serveServer } from '@nsec/server';
import { createCredentialStore } from '@nsec/keyring';
import { executeRegister } from '../src/commands/register.js';
import { executeInvite } from '../src/commands/invite.js';
import {
  executeListUsers,
  executePromoteUser,
  executeDemoteUser,
  executeListInvites,
  executeRevokeInvite
} from '../src/commands/admin.js';
import { executeRotateKeys } from '../src/commands/rotate-keys.js';

describe('Admin, Invite & Key Rotation CLI Commands', () => {
  let server: any;
  let serverUrl: string;

  before(async () => {
    const db = new MemoryDatabaseAdapter();
    const app = createHonoServer({ db });
    const instance = await serveServer(app);
    server = instance.server;
    serverUrl = instance.url;
  });

  after(() => {
    server?.close();
  });



  it('runs full admin invite and key rotation workflow', async () => {
    const adminStore = await createCredentialStore({ mode: 'memory' });
    const memberStore = await createCredentialStore({ mode: 'memory' });

    // 1. First user registers and becomes admin
    const adminReg = await executeRegister('admin@company.com', {
      serverUrl,
      credentialStore: adminStore
    });
    assert.equal(adminReg.email, 'admin@company.com');
    assert.equal(adminReg.role, 'admin');

    // 2. Admin creates invite for member
    const inviteRes = await executeInvite('developer@company.com', {
      role: 'member',
      serverUrl,
      credentialStore: adminStore,
      expiresInDays: 7
    });
    assert.ok(inviteRes.token);
    assert.equal(inviteRes.email, 'developer@company.com');
    assert.equal(inviteRes.role, 'member');
    assert.ok(inviteRes.registrationCommand.includes(inviteRes.token));

    // 3. Member registers with token
    const memberReg = await executeRegister('developer@company.com', {
      serverUrl,
      token: inviteRes.token,
      credentialStore: memberStore
    });
    assert.equal(memberReg.email, 'developer@company.com');
    assert.equal(memberReg.role, 'member');

    // 4. Non-admin attempting to create an invite fails
    await assert.rejects(
      async () => {
        await executeInvite('unauthorized@company.com', {
          serverUrl,
          credentialStore: memberStore
        });
      },
      /Admin role required/i
    );

    // 5. Admin lists users
    const users = await executeListUsers({ serverUrl, credentialStore: adminStore });
    assert.equal(users.length, 2);

    // 6. Admin promotes member to admin
    const promoted = await executePromoteUser('developer@company.com', { serverUrl, credentialStore: adminStore });
    assert.equal(promoted.role, 'admin');

    // 7. Admin demotes member back
    const demoted = await executeDemoteUser('developer@company.com', { serverUrl, credentialStore: adminStore });
    assert.equal(demoted.role, 'member');

    // 8. Member rotates keys
    const rotRes = await executeRotateKeys({ serverUrl, credentialStore: memberStore });
    assert.equal(rotRes.email, 'developer@company.com');

    // 9. Admin creates second invite and revokes it
    const invite2 = await executeInvite('contractor@company.com', {
      serverUrl,
      credentialStore: adminStore
    });
    const pendingInvites = await executeListInvites({ serverUrl, credentialStore: adminStore });
    assert.ok(pendingInvites.some((inv) => inv.email === 'contractor@company.com'));

    const revokeRes = await executeRevokeInvite(invite2.id, { serverUrl, credentialStore: adminStore });
    assert.equal(revokeRes.success, true);
  });
});
