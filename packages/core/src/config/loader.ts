import fs from 'node:fs/promises';
import path from 'node:path';
import { NullSecConfigSchema, type NullSecConfig, type NullSecConfigInput } from '../schemas/config.schema.js';
import { resolveEnvOverrides } from './env.js';
import { ConfigError } from '../errors.js';

const CONFIG_FILES = [
  'nullsec.config.json',
  '.nullsecrc.json',
  '.nullsecrc',
  '.nullsec/config.json',
  'nsec.config.json',
  '.nsecrc.json',
  '.nsecrc',
  '.nsec/config.json',
  'zvault.config.json',
  '.zvaultrc.json',
  '.zvaultrc',
  '.zvault/config.json'
];

export async function findConfigFile(startDir: string = process.cwd()): Promise<string | null> {
  let currentDir = path.resolve(startDir);

  while (true) {
    for (const filename of CONFIG_FILES) {
      const fullPath = path.join(currentDir, filename);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isFile()) {
          return fullPath;
        }
      } catch {
        // File doesn't exist, continue searching
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break; // Reached root
    }
    currentDir = parentDir;
  }

  return null;
}

export async function loadConfig(
  cwd: string = process.cwd(),
  explicitOverrides?: Partial<NullSecConfigInput>
): Promise<NullSecConfig> {
  let fileConfig: Record<string, unknown> = {};
  const configFile = await findConfigFile(cwd);

  if (configFile) {
    try {
      const rawContent = await fs.readFile(configFile, 'utf-8');
      fileConfig = JSON.parse(rawContent);
    } catch (err: unknown) {
      throw new ConfigError(`Failed to parse config file ${configFile}: ${(err as Error)?.message}`);
    }
  }

  const envOverrides = resolveEnvOverrides();
  const merged = {
    ...fileConfig,
    ...envOverrides,
    ...explicitOverrides
  };

  const parseResult = NullSecConfigSchema.safeParse(merged);
  if (!parseResult.success) {
    const issues = (parseResult.error as any).issues || (parseResult.error as any).errors || [];
    const errorMsg = issues.length > 0
      ? issues.map((e: any) => `${e.path?.join('.') || 'config'}: ${e.message}`).join('; ')
      : parseResult.error.message;
    throw new ConfigError(`Invalid NullSec configuration: ${errorMsg}`);
  }

  return parseResult.data;
}
