import type { NullSecConfigInput } from '../schemas/config.schema.js';

export function resolveEnvOverrides(): Partial<NullSecConfigInput> {
  const overrides: Partial<NullSecConfigInput> = {};

  const project = process.env.NULLSEC_PROJECT || process.env.NSEC_PROJECT || process.env.ZVAULT_PROJECT;
  if (project) {
    overrides.project = project;
  }

  const env = process.env.NULLSEC_ENV || process.env.NSEC_ENV || process.env.ZVAULT_ENV;
  if (env) {
    overrides.defaultEnvironment = env;
  }

  const serverUrl = process.env.NULLSEC_SERVER_URL || process.env.NSEC_SERVER_URL || process.env.ZVAULT_SERVER_URL;
  if (serverUrl) {
    overrides.serverUrl = serverUrl;
  }

  const storage = process.env.NULLSEC_STORAGE || process.env.NSEC_STORAGE || process.env.ZVAULT_STORAGE;
  if (storage && ['keyring', 'file', 'memory'].includes(storage)) {
    overrides.storage = storage as 'keyring' | 'file' | 'memory';
  }

  return overrides;
}
