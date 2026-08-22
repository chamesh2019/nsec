import fs from 'node:fs/promises';
import path from 'node:path';
import { ZVaultConfigSchema, type ZVaultConfig, type ZVaultConfigInput } from '../schemas/config.schema.js';
import { resolveEnvOverrides } from './env.js';
import { ConfigError } from '../errors.js';

const CONFIG_FILES = [
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
  explicitOverrides?: Partial<ZVaultConfigInput>
): Promise<ZVaultConfig> {
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

  const parseResult = ZVaultConfigSchema.safeParse(merged);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new ConfigError(`Invalid zvault configuration: ${errorMsg}`);
  }

  return parseResult.data;
}
