import { loadConfig, NullSecApiClient, type UserDTO, type InviteTokenDTO } from '@nsec/core';
import { createCredentialStore, type StorageMode, type KeyringStorage } from '@nsec/keyring';
import { normalizeServerUrl } from './url-helpers.js';
import { getRequiredCredentials } from './auth-helper.js';

export interface AdminCommandOptions {
  serverUrl?: string;
  storage?: StorageMode;
  credentialStore?: KeyringStorage;
  cwd?: string;
}

async function getAdminClient(options: AdminCommandOptions = {}): Promise<{ client: NullSecApiClient; serverUrl: string }> {
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

  return { client, serverUrl: normServerUrl };
}

export async function executeListUsers(options: AdminCommandOptions = {}): Promise<UserDTO[]> {
  const { client } = await getAdminClient(options);
  return client.listUsers();
}

export async function executePromoteUser(
  emailOrId: string,
  options: AdminCommandOptions = {}
): Promise<UserDTO> {
  const { client } = await getAdminClient(options);
  const user = await client.getUser(emailOrId);
  return client.updateUserRole(user.id, 'admin');
}

export async function executeDemoteUser(
  emailOrId: string,
  options: AdminCommandOptions = {}
): Promise<UserDTO> {
  const { client } = await getAdminClient(options);
  const user = await client.getUser(emailOrId);
  return client.updateUserRole(user.id, 'member');
}

export async function executeListInvites(options: AdminCommandOptions = {}): Promise<InviteTokenDTO[]> {
  const { client } = await getAdminClient(options);
  return client.listInvites();
}

export async function executeRevokeInvite(
  inviteId: string,
  options: AdminCommandOptions = {}
): Promise<{ success: boolean; id: string }> {
  const { client } = await getAdminClient(options);
  const res = await client.revokeInvite(inviteId);
  return { success: res.success, id: inviteId };
}
