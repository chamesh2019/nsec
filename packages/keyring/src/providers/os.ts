import { AsyncEntry } from '@napi-rs/keyring';
import type { KeyringCredentials, KeyringStorage, StorageMode } from '../types.js';
import { InvalidCredentialsError } from '../errors.js';

export class OSKeyringProvider implements KeyringStorage {
  public readonly name: StorageMode = 'keyring';
  private readonly service: string;

  constructor(service = 'nullsec') {
    this.service = service;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const probeEntry = new AsyncEntry(this.service, '__nullsec_probe__');
      await probeEntry.getPassword();
      return true;
    } catch {
      return false;
    }
  }

  private async getAccountIndex(): Promise<string[]> {
    try {
      const entry = new AsyncEntry(this.service, '__nullsec_index__');
      const data = await entry.getPassword();
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private async saveAccountIndex(accounts: string[]): Promise<void> {
    try {
      const entry = new AsyncEntry(this.service, '__nullsec_index__');
      await entry.setPassword(JSON.stringify(Array.from(new Set(accounts))));
    } catch {}
  }

  async saveCredentials(account: string, credentials: KeyringCredentials): Promise<void> {
    if (!credentials || !credentials.keyId || !credentials.privateKey) {
      throw new InvalidCredentialsError('Both keyId and privateKey are required.');
    }
    const payload = JSON.stringify({ ...credentials });
    const entry = new AsyncEntry(this.service, account);
    await entry.setPassword(payload);

    const accounts = await this.getAccountIndex();
    if (!accounts.includes(account)) {
      accounts.push(account);
      await this.saveAccountIndex(accounts);
    }
  }

  async getCredentials(account: string): Promise<KeyringCredentials | null> {
    try {
      const entry = new AsyncEntry(this.service, account);
      const payload = await entry.getPassword();
      if (!payload) return null;
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  async deleteCredentials(account: string): Promise<boolean> {
    try {
      const entry = new AsyncEntry(this.service, account);
      await entry.deletePassword();
      const accounts = await this.getAccountIndex();
      const filtered = accounts.filter((a) => a !== account);
      await this.saveAccountIndex(filtered);
      return true;
    } catch {
      return false;
    }
  }

  async listAccounts(): Promise<string[]> {
    return this.getAccountIndex();
  }
}
