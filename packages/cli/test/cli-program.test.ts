import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCliProgram, CLI_VERSION } from '../src/index.js';

describe('buildCliProgram', () => {
  it('registers all commands and parses help and version', () => {
    const program = buildCliProgram();
    program.exitOverride();

    assert.equal(program.name(), 'nsec');
    assert.equal(program.version(), CLI_VERSION);

    const commandNames = program.commands.map((c) => c.name());
    assert.ok(commandNames.includes('run'));
    assert.ok(commandNames.includes('register'));
    assert.ok(commandNames.includes('init'));
    assert.ok(commandNames.includes('set'));
    assert.ok(commandNames.includes('get'));
    assert.ok(commandNames.includes('member'));
    assert.ok(commandNames.includes('token'));
  });
});
