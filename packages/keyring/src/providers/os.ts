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

  async saveCredentials(account: string, credentials: KeyringCredentials): Promise<void> {
    if (!credentials || !credentials.keyId || !credentials.privateKey) {
      throw new InvalidCredentialsError('Both keyId and privateKey are required.');
    }
    const payload = JSON.stringify({ ...credentials });
    const entry = new AsyncEntry(this.service, account);
    await entry.setPassword(payload);
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
      return true;
    } catch {
      return false;
    }
  }
}
