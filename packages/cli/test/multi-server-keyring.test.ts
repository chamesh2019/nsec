import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createCredentialStore } from '@nsec/keyring';
import { executeRegister } from '../src/commands/register.js';
import { executeInit } from '../src/commands/init.js';
import { getRequiredCredentials } from '../src/commands/auth-helper.js';
import { executeWhoami, executeListKeys } from '../src/commands/keys.js';
import { serverAccountKey } from '../src/commands/url-helpers.js';

describe('Multi-Server Keyring Architecture', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zvault-multi-server-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('stores independent keypairs for multiple servers without clobbering', async () => {
    const store = await createCredentialStore({ mode: 'memory' });

    const serverA = 'https://nsec.company.com';
    const serverB = 'https://nsec.personal.dev';

    const regA = await executeRegister('alice@company.com', {
      serverUrl: serverA,
      credentialStore: store,
      skipServerSync: true
    });
    assert.equal(regA.email, 'alice@company.com');

    const regB = await executeRegister('alice@personal.dev', {
      serverUrl: serverB,
      credentialStore: store,
      skipServerSync: true
    });
    assert.equal(regB.email, 'alice@personal.dev');

    // Verify memory store has both server keys with their own emails and private keys
    const credsA = await store.getCredentials(serverAccountKey(serverA));
    const credsB = await store.getCredentials(serverAccountKey(serverB));

    assert.ok(credsA);
    assert.ok(credsB);
    assert.equal(credsA.email, 'alice@company.com');
    assert.equal(credsB.email, 'alice@personal.dev');
    assert.notEqual(credsA.privateKey, credsB.privateKey);
  });

  it('resolves the correct credentials for a given serverUrl via auth-helper', async () => {
    const store = await createCredentialStore({ mode: 'memory' });
    const server1 = 'https://nsec.server-one.com';
    const server2 = 'https://nsec.server-two.com';

    await store.saveCredentials(serverAccountKey(server1), {
      keyId: 'key_1',
      email: 'user@server-one.com',
      serverUrl: server1,
      privateKey: 'priv_1',
      publicKey: 'pub_1',
      token: 'tok_1'
    });

    await store.saveCredentials(serverAccountKey(server2), {
      keyId: 'key_2',
      email: 'user@server-two.com',
      serverUrl: server2,
      privateKey: 'priv_2',
      publicKey: 'pub_2',
      token: 'tok_2'
    });

    // Resolving project with server1
    const resolved1 = await getRequiredCredentials('my-project-1', store, server1);
    assert.equal(resolved1.email, 'user@server-one.com');
    assert.equal(resolved1.privateKey, 'priv_1');

    // Resolving project with server2
    const resolved2 = await getRequiredCredentials('my-project-2', store, server2);
    assert.equal(resolved2.email, 'user@server-two.com');
    assert.equal(resolved2.privateKey, 'priv_2');
  });

  it('falls back to default credentials if server-scoped key is not found', async () => {
    const store = await createCredentialStore({ mode: 'memory' });
    await store.saveCredentials('default', {
      keyId: 'key_default',
      email: 'legacy@default.com',
      serverUrl: 'https://nsec.chames.dev',
      privateKey: 'priv_default',
      publicKey: 'pub_default',
      token: 'tok_default'
    });

    const resolved = await getRequiredCredentials('legacy-project', store, 'https://nsec.other.com');
    assert.equal(resolved.email, 'legacy@default.com');
  });

  it('init reuses the server-scoped key when present and does not duplicate keys in keyring', async () => {
    const store = await createCredentialStore({ mode: 'memory' });
    const server = 'https://nsec.my-server.com';

    await store.saveCredentials(serverAccountKey(server), {
      keyId: 'key_server',
      email: 'dev@my-server.com',
      serverUrl: server,
      privateKey: 'priv_server',
      publicKey: 'pub_server',
      token: 'tok_server'
    });

    await executeInit({
      project: 'project-alpha',
      serverUrl: server,
      credentialStore: store,
      cwd: tempDir
    });

    // Verify nullsec.config.json was written
    const rawConfig = await fs.readFile(path.join(tempDir, 'nullsec.config.json'), 'utf-8');
    const config = JSON.parse(rawConfig);
    assert.equal(config.project, 'project-alpha');
    assert.equal(config.serverUrl, server);

    // Verify no redundant 'project-alpha' key was created in keyring
    const projCreds = await store.getCredentials('project-alpha');
    assert.equal(projCreds, null);
  });

  it('whoami returns multi-server summary when outside a project', async () => {
    const store = await createCredentialStore({ mode: 'file' });
    const server1 = 'https://nsec.work.com';
    const server2 = 'https://nsec.personal.dev';

    await store.saveCredentials(serverAccountKey(server1), {
      keyId: 'key_work',
      email: 'alice@work.com',
      serverUrl: server1,
      privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----',
      publicKey: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA123...\n-----END PUBLIC KEY-----',
      token: 'tok_work'
    });

    await store.saveCredentials(serverAccountKey(server2), {
      keyId: 'key_pers',
      email: 'alice@personal.dev',
      serverUrl: server2,
      privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----',
      publicKey: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA456...\n-----END PUBLIC KEY-----',
      token: 'tok_pers'
    });

    const res = await executeWhoami({
      storage: 'file',
      cwd: tempDir // outside any project directory (no nullsec.config.json)
    });

    assert.equal(res.isMultiServer, true);
    assert.equal(res.identities.length >= 2, true);
    const emails = res.identities.map((id) => id.userEmail);
    assert.ok(emails.includes('alice@work.com'));
    assert.ok(emails.includes('alice@personal.dev'));

    // Test with explicit --server filter
    const resFiltered = await executeWhoami({
      storage: 'file',
      serverUrl: server1,
      cwd: tempDir
    });
    assert.equal(resFiltered.isMultiServer, false);
    assert.equal(resFiltered.userEmail, 'alice@work.com');
    assert.equal(resFiltered.serverUrl, server1);
  });

  it('listKeys formats server-scoped keys with email addresses', async () => {
    const store = await createCredentialStore({ mode: 'file' });
    const server = 'https://nsec.formatted-test.com';

    await store.saveCredentials(serverAccountKey(server), {
      keyId: 'key_fmt',
      email: 'formatted@test.com',
      serverUrl: server,
      privateKey: 'priv_fmt',
      publicKey: 'pub_fmt',
      token: 'tok_fmt'
    });

    const list = await executeListKeys({ storage: 'file', cwd: tempDir });
    assert.ok(list.some((item) => item.includes('https://nsec.formatted-test.com') && item.includes('formatted@test.com')));
  });
});
