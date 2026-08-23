import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, type NullSecConfig } from '@nsec/core';
import { createCredentialStore, type KeyringStorage } from '@nsec/keyring';
import { parseDotenv, type ParsedEntry } from './dotenv-parser.js';
import { executeSet } from './secrets.js';

export interface ExecuteMigrateOptions {
  /** Path to the .env file. Relative paths resolve against `cwd`. */
  file: string;
  env?: string;
  configOverride?: Partial<NullSecConfig>;
  credentialStore?: KeyringStorage;
  cwd?: string;
  dryRun?: boolean;
  /**
   * Override the per-key upload function. Defaults to `executeSet`.
   * Exposed for tests so the upload path can be stubbed without spinning
   * up a real server. Production callers should leave this unset.
   */
  uploader?: (key: string, value: string, opts: SecretUploadContext) => Promise<unknown>;
}

export interface SecretUploadContext {
  env?: string;
  configOverride?: Partial<NullSecConfig>;
  credentialStore?: KeyringStorage;
  cwd?: string;
}

export interface MigrateResult {
  file: string;
  environment: string;
  uploaded: string[];
  skipped: Array<{ key: string; reason: string }>;
  invalid: Array<{ line: number; reason: string }>;
  redactedCount: number;
  dryRun: boolean;
}

const REDACTED = '[REDACTED]';

/**
 * Read a standard .env file, upload each KEY=VALUE to NullSec via
 * `executeSet`, and overwrite the file with `[REDACTED]` placeholders so
 * the plaintext values no longer sit on disk.
 *
 * Stops on the first upload failure; the file is left untouched in that
 * case. Already-uploaded secrets remain in NullSec and the user can rerun
 * to retry.
 */
export async function executeMigrate(
  options: ExecuteMigrateOptions
): Promise<MigrateResult> {
  const cwd = options.cwd || process.cwd();
  const filePath = path.isAbsolute(options.file)
    ? options.file
    : path.resolve(cwd, options.file);

  const original = await fs.readFile(filePath, 'utf-8');
  const parsed = parseDotenv(original);

  const config = await loadConfig(cwd, options.configOverride);
  const environment = options.env || config.defaultEnvironment || 'development';
  const credentialStore =
    options.credentialStore || (await createCredentialStore({ mode: config.storage }));

  const uploaded: string[] = [];
  const skipped: MigrateResult['skipped'] = [];

  if (options.dryRun) {
    return {
      file: filePath,
      environment,
      uploaded: parsed.entries.map((e) => e.key),
      skipped,
      invalid: parsed.invalid,
      redactedCount: 0,
      dryRun: true
    };
  }

  // Upload each entry one at a time. `executeSet` is a full round-trip
  // (fetch → decrypt → merge → encrypt → upload), so serial calls keep
  // the server-side state consistent without us re-implementing it.
  const upload = options.uploader ?? executeSet;
  const uploadCtx: SecretUploadContext = {
    env: environment,
    configOverride: options.configOverride,
    credentialStore,
    cwd
  };

  for (const entry of parsed.entries) {
    if (entry.value === '') {
      skipped.push({ key: entry.key, reason: 'empty value' });
      continue;
    }

    await upload(entry.key, entry.value, uploadCtx);
    uploaded.push(entry.key);
  }

  // All uploads succeeded — now redact the file in place.
  const redactedLines = redactLines(parsed.lines, parsed.entries, uploaded);
  const redactedContent = redactedLines.join('\n');
  await fs.writeFile(filePath, redactedContent, 'utf-8');

  return {
    file: filePath,
    environment,
    uploaded,
    skipped,
    invalid: parsed.invalid,
    redactedCount: uploaded.length,
    dryRun: false
  };
}

/**
 * Replace uploaded values with `[REDACTED]` while preserving everything
 * else: key name, leading `export ` prefix, original quoting style, and
 * trailing inline comments on unquoted values.
 */
function redactLines(
  lines: string[],
  entries: ParsedEntry[],
  uploadedKeys: string[]
): string[] {
  const uploadedSet = new Set(uploadedKeys);
  const entryByKey = new Map(entries.map((e) => [e.key, e]));
  const out = lines.slice();

  for (const key of uploadedSet) {
    const entry = entryByKey.get(key);
    if (!entry) continue;
    const idx = entry.line - 1;
    const originalLine = lines[idx];

    out[idx] = originalLine.replace(/^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/, (_match, prefix: string, k: string, eq: string, rest: string) => {
      if (k !== key) return _match;
      return `${prefix}${k}${eq}${formatRedactedValue(entry.quoted, rest)}`;
    });
  }

  return out;
}

/**
 * Preserve the original value's trailing form so the rewritten line still
 * looks idiomatic (e.g. `KEY=[REDACTED]`, `KEY="[REDACTED]"`,
 * `KEY='[REDACTED]'`).
 */
function formatRedactedValue(quoted: ParsedEntry['quoted'], originalRest: string): string {
  const trimmed = originalRest.trimStart();
  switch (quoted) {
    case 'double':
      return `"${REDACTED}"`;
    case 'single':
      return `'${REDACTED}'`;
    case 'none':
    default:
      // If the original had a trailing inline comment, keep the comment.
      const hashIdx = trimmed.search(/\s#/);
      if (hashIdx !== -1) {
        return `${REDACTED}${trimmed.slice(hashIdx)}`;
      }
      return REDACTED;
  }
}
