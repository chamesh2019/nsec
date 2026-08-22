import type { ZVaultConfigInput } from '../schemas/config.schema.js';

export function resolveEnvOverrides(): Partial<ZVaultConfigInput> {
  const overrides: Partial<ZVaultConfigInput> = {};

  if (process.env.ZVAULT_PROJECT) {
    overrides.project = process.env.ZVAULT_PROJECT;
  }
  if (process.env.ZVAULT_ENV) {
    overrides.defaultEnvironment = process.env.ZVAULT_ENV;
  }
  if (process.env.ZVAULT_SERVER_URL) {
    overrides.serverUrl = process.env.ZVAULT_SERVER_URL;
  }
  if (process.env.ZVAULT_STORAGE && ['keyring', 'file', 'memory'].includes(process.env.ZVAULT_STORAGE)) {
    overrides.storage = process.env.ZVAULT_STORAGE as 'keyring' | 'file' | 'memory';
  }

  return overrides;
}
