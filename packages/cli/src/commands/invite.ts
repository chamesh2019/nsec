import { loadConfig, NullSecApiClient, type ServerUserRole } from '@nsec/core';
import { createCredentialStore, type StorageMode, type KeyringStorage } from '@nsec/keyring';
import { normalizeServerUrl } from './url-helpers.js';
import { getRequiredCredentials } from './auth-helper.js';

export interface InviteCommandOptions {
  role?: ServerUserRole;
  serverUrl?: string;
  storage?: StorageMode;
  credentialStore?: KeyringStorage;
  expiresInDays?: number;
  cwd?: string;
}

export interface InviteResult {
  id: string;
  email: string;
  role: ServerUserRole;
  token: string;
  serverUrl: string;
  registrationCommand: string;
  expiresAt?: string;
}

export async function executeInvite(
  email: string,
  options: InviteCommandOptions = {}
): Promise<InviteResult> {
  const cwd = options.cwd || process.cwd();
  let serverUrl = options.serverUrl;
  let storageMode = options.storage || 'keyring';

  try {
    const config = await loadConfig(cwd);
    serverUrl = serverUrl || config.serverUrl;
    storageMode = options.storage || config.storage || 'keyring';
  } catch {
    serverUrl = serverUrl || 'https://nsec.chames.dev';
  }

  const normServerUrl = normalizeServerUrl(serverUrl);
  const store = options.credentialStore || (await createCredentialStore({ mode: storageMode }));
  const creds = await getRequiredCredentials('global', store, normServerUrl);

  const client = new NullSecApiClient({
    serverUrl: normServerUrl,
    signingKeys: {
      privateKey: creds.token || creds.privateKey,
      publicKey: creds.publicKey || ''
    }
  });

  let expiresAt: string | undefined;
  if (options.expiresInDays && options.expiresInDays > 0) {
    const d = new Date();
    d.setDate(d.getDate() + options.expiresInDays);
    expiresAt = d.toISOString();
  }

  const role: ServerUserRole = options.role || 'member';
  const invite = await client.createInvite({
    email,
    role,
    expiresAt
  });

  const rawToken = invite.token || '';
  const registrationCommand = `nsec register ${email} --token ${rawToken} --server ${normServerUrl}`;

  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    token: rawToken,
    serverUrl: normServerUrl,
    registrationCommand,
    expiresAt: invite.expiresAt
  };
}
