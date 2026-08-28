import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { signPayload } from '@nsec/crypto';
import { loadConfig } from '@nsec/core';
import { createCredentialStore, type StorageMode, type KeyringStorage } from '@nsec/keyring';
import { normalizeServerUrl } from './url-helpers.js';
import { getRequiredCredentials } from './auth-helper.js';

export interface DashboardCommandOptions {
  serverUrl?: string;
  storage?: StorageMode;
  credentialStore?: KeyringStorage;
  noOpen?: boolean;
  cwd?: string;
}

export interface DashboardResult {
  dashboardUrl: string;
  email: string;
  serverUrl: string;
}

export async function executeDashboard(
  options: DashboardCommandOptions = {}
): Promise<DashboardResult> {
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

  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = {
    action: 'dashboard_login' as const,
    email: creds.email || '',
    serverUrl: normServerUrl,
    nonce
  };

  const signed = signPayload(
    payload,
    creds.token || creds.privateKey,
    creds.publicKey || ''
  );

  const ticket = Buffer.from(JSON.stringify(signed), 'utf-8').toString('base64url');
  const dashboardUrl = `${normServerUrl}/dashboard#auth=${encodeURIComponent(ticket)}`;

  if (!options.noOpen && process.env.NODE_ENV !== 'test') {
    try {
      openBrowser(dashboardUrl);
    } catch {
      // Ignore open failure in headless/SSH environments
    }
  }

  return {
    dashboardUrl,
    email: creds.email || '',
    serverUrl: normServerUrl
  };
}

function openBrowser(url: string): void {
  const platform = process.platform;
  if (platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  } else if (platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
}
