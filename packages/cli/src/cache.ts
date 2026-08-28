import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { normalizeServerUrl } from './commands/url-helpers.js';
import {
  ApiClientError,
  AuthenticationError,
  NotFoundError,
  type EncryptedSecretsPayloadDTO,
  type EncryptedProjectKeyDTO
} from '@nsec/core';

export interface CachedSecretsPayload {
  projectId: string;
  environment: string;
  serverUrl: string;
  secretsPayload: EncryptedSecretsPayloadDTO;
  encryptedProjectKey: EncryptedProjectKeyDTO;
  version: number;
  updatedAt: string;
  cachedAt: string;
}

export function sanitizeServerKey(serverUrl: string): string {
  const normalized = normalizeServerUrl(serverUrl);
  return normalized
    .replace(/^https?:\/\//i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase() || 'default_server';
}

export function isNetworkError(err: unknown): boolean {
  if (!err) return false;

  // Never treat authentication or not found errors as network errors
  if (err instanceof AuthenticationError || err instanceof NotFoundError) {
    return false;
  }

  if (err instanceof ApiClientError) {
    // If status is 0 or undefined, or message indicates network failure
    return !err.statusCode || err.statusCode === 0;
  }

  if (err instanceof TypeError && /fetch failed/i.test(err.message)) {
    return true;
  }

  const code = (err as any).code || (err as any).cause?.code;
  const networkCodes = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'EAI_AGAIN',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET',
    'ECONNRESET'
  ];

  if (code && networkCodes.includes(code)) {
    return true;
  }

  const msg = (err as Error).message || '';
  if (/fetch failed|network|econnrefused|enotfound|timed out|socket hang up/i.test(msg)) {
    // Make sure it's not a generic application error mentioning network
    if ((err as any).name === 'TypeError' || (err as any).name === 'FetchError' || code) {
      return true;
    }
  }

  return false;
}

export class SecretsCache {
  private readonly baseDir: string;

  constructor(customBasePath?: string) {
    this.baseDir = customBasePath || path.join(os.homedir(), '.nullsec', 'cache');
  }

  getCacheFilePath(serverUrl: string, projectId: string, environment: string): string {
    const serverKey = sanitizeServerKey(serverUrl);
    const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeEnv = environment.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.baseDir, serverKey, safeProject, `${safeEnv}.json`);
  }

  async get(serverUrl: string, projectId: string, environment: string): Promise<CachedSecretsPayload | null> {
    const filePath = this.getCacheFilePath(serverUrl, projectId, environment);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (!data || typeof data !== 'object') {
        return null;
      }
      return data as CachedSecretsPayload;
    } catch {
      return null;
    }
  }

  async set(
    serverUrl: string,
    projectId: string,
    environment: string,
    payload: Omit<CachedSecretsPayload, 'cachedAt'>
  ): Promise<void> {
    const filePath = this.getCacheFilePath(serverUrl, projectId, environment);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true, mode: 0o700 });

    const fullPayload: CachedSecretsPayload = {
      ...payload,
      projectId,
      environment,
      serverUrl,
      cachedAt: new Date().toISOString()
    };

    const tempFile = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    const data = JSON.stringify(fullPayload, null, 2);

    await fs.writeFile(tempFile, data, { mode: 0o600, encoding: 'utf-8' });
    if (process.platform !== 'win32') {
      try {
        await fs.chmod(tempFile, 0o600);
      } catch {
        // ignore chmod errors on systems that do not support it
      }
    }

    await fs.rename(tempFile, filePath);
  }

  async delete(serverUrl: string, projectId: string, environment: string): Promise<boolean> {
    const filePath = this.getCacheFilePath(serverUrl, projectId, environment);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.rm(this.baseDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
