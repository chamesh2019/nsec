import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDotenv } from '../src/commands/dotenv-parser.js';

describe('parseDotenv', () => {
  it('parses simple KEY=value pairs', () => {
    const r = parseDotenv('FOO=bar\nBAZ=qux\n');
    assert.deepEqual(
      r.entries.map((e) => ({ key: e.key, value: e.value })),
      [
        { key: 'FOO', value: 'bar' },
        { key: 'BAZ', value: 'qux' }
      ]
    );
    assert.equal(r.entries[0].line, 1);
    assert.equal(r.entries[1].line, 2);
    assert.equal(r.entries[0].quoted, 'none');
    assert.equal(r.entries[0].exportPrefix, false);
  });

  it('supports double-quoted values with spaces and # inside', () => {
    const r = parseDotenv('DB_URL="postgres://user:p#ss@host/db"\n');
    assert.equal(r.entries.length, 1);
    assert.equal(r.entries[0].value, 'postgres://user:p#ss@host/db');
    assert.equal(r.entries[0].quoted, 'double');
  });

  it('supports single-quoted values', () => {
    const r = parseDotenv("TOKEN='abc def'\n");
    assert.equal(r.entries[0].value, 'abc def');
    assert.equal(r.entries[0].quoted, 'single');
  });

  it('accepts the export prefix', () => {
    const r = parseDotenv('export NODE_ENV=production\n');
    assert.equal(r.entries[0].key, 'NODE_ENV');
    assert.equal(r.entries[0].value, 'production');
    assert.equal(r.entries[0].exportPrefix, true);
  });

  it('strips inline # comments on unquoted values', () => {
    const r = parseDotenv('KEY=value # this is a comment\n');
    assert.equal(r.entries[0].value, 'value');
  });

  it('keeps # characters inside quoted values', () => {
    const r = parseDotenv('KEY="value # with hash"\n');
    assert.equal(r.entries[0].value, 'value # with hash');
  });

  it('skips blank lines and # comment lines but counts them in lines', () => {
    const content = '\n# leading comment\nFOO=bar\n\n# trailing\n';
    const r = parseDotenv(content);
    assert.equal(r.entries.length, 1);
    assert.equal(r.entries[0].key, 'FOO');
    // '\n# leading\nFOO=bar\n\n# trailing\n' splits to 6 segments.
    assert.equal(r.lines.length, 6);
    assert.equal(r.lines[1], '# leading comment');
    assert.equal(r.lines[3], '');
  });

  it('reports invalid keys without throwing', () => {
    const r = parseDotenv('1BAD=value\nGOOD=ok\n-FOO=bar\n');
    assert.equal(r.entries.length, 1);
    assert.equal(r.entries[0].key, 'GOOD');
    assert.equal(r.invalid.length, 2);
    assert.match(r.invalid[0].reason, /invalid key/);
  });

  it('reports unterminated quoted values', () => {
    const r = parseDotenv('BAD="no closing quote\nGOOD=ok\n');
    assert.equal(r.entries.length, 1);
    assert.equal(r.entries[0].key, 'GOOD');
    assert.equal(r.invalid.length, 1);
    assert.match(r.invalid[0].reason, /unterminated/);
  });

  it('reports lines without =', () => {
    const r = parseDotenv('NOEQUALS\nOK=value\n');
    assert.equal(r.entries.length, 1);
    assert.equal(r.entries[0].key, 'OK');
    assert.equal(r.invalid.length, 1);
    assert.match(r.invalid[0].reason, /missing/);
  });

  it('preserves original line content via the lines array', () => {
    const content = '# header\nFOO=bar\n\nBAZ=qux\n';
    const r = parseDotenv(content);
    assert.deepEqual(r.lines, ['# header', 'FOO=bar', '', 'BAZ=qux', '']);
  });
});
