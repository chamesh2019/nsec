/**
 * Minimal dotenv subset parser for the `migrate` command.
 *
 * Supports:
 *   - blank lines and `#` comment lines (skipped, still counted in `lines`)
 *   - `export ` prefix (recorded, value unaffected)
 *   - unquoted, double-quoted, and single-quoted values
 *   - inline `#` comments on unquoted values
 *
 * Out of scope (matches the chosen parser scope):
 *   - variable expansion (`$VAR` / `${VAR}`)
 *   - multiline quoted values
 *   - `.env` includes
 */

export interface ParsedEntry {
  key: string;
  value: string;
  /** 1-indexed line number in the source content. */
  line: number;
  quoted: 'none' | 'single' | 'double';
  exportPrefix: boolean;
}

export interface ParseResult {
  entries: ParsedEntry[];
  /** Original content split on `\n`. Trailing empty string preserved if the file ended with `\n`. */
  lines: string[];
  /** Keys/lines that looked like assignments but were skipped because they failed validation. */
  invalid: Array<{ line: number; reason: string }>;
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseDotenv(content: string): ParseResult {
  // Preserve trailing newline behavior: split without trimming the final
  // empty segment so we can re-emit the file byte-for-byte.
  const lines = content.split('\n');
  const entries: ParsedEntry[] = [];
  const invalid: ParseResult['invalid'] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNo = i + 1;
    const trimmed = rawLine.trim();

    // Blank or full-line comment
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    // Strip optional `export ` prefix
    let body = trimmed;
    let exportPrefix = false;
    if (body.startsWith('export ')) {
      exportPrefix = true;
      body = body.slice('export '.length).trimStart();
    }

    const eqIdx = body.indexOf('=');
    if (eqIdx === -1) {
      invalid.push({ line: lineNo, reason: 'missing `=` separator' });
      continue;
    }

    const key = body.slice(0, eqIdx).trim();
    if (!KEY_RE.test(key)) {
      invalid.push({ line: lineNo, reason: `invalid key "${key}"` });
      continue;
    }

    let valuePart = body.slice(eqIdx + 1);
    let quoted: ParsedEntry['quoted'] = 'none';
    let value: string;

    // Detect leading quote
    const first = valuePart[0];
    if (first === '"' || first === "'") {
      quoted = first === '"' ? 'double' : 'single';
      const closeIdx = valuePart.indexOf(first, 1);
      if (closeIdx === -1) {
        invalid.push({ line: lineNo, reason: `unterminated ${quoted} quote` });
        continue;
      }
      value = valuePart.slice(1, closeIdx);
      // Anything after the closing quote is ignored (no inline-comment
      // handling inside quoted values).
    } else {
      // Unquoted: strip an inline `#` comment preceded by whitespace
      const hashIdx = valuePart.search(/\s#/);
      if (hashIdx !== -1) {
        valuePart = valuePart.slice(0, hashIdx);
      }
      value = valuePart.trim();
    }

    entries.push({ key, value, line: lineNo, quoted, exportPrefix });
  }

  return { entries, lines, invalid };
}
