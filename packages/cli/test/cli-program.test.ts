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
    assert.ok(commandNames.includes('invite'));
    assert.ok(commandNames.includes('rotate-keys'));
    assert.ok(commandNames.includes('dashboard'));
    assert.ok(commandNames.includes('admin'));
    assert.ok(commandNames.includes('whoami'));
    assert.ok(commandNames.includes('keys'));
    assert.ok(commandNames.includes('init'));
    assert.ok(commandNames.includes('set'));
    assert.ok(commandNames.includes('get'));
    assert.ok(commandNames.includes('migrate'));
    assert.ok(commandNames.includes('member'));
    assert.ok(commandNames.includes('token'));


    // Check register options
    const registerCmd = program.commands.find((c) => c.name() === 'register');
    assert.ok(registerCmd);
    const regFlags = registerCmd.options.map((o) => o.flags);
    assert.ok(regFlags.some((f) => f.includes('--token')));

    // Check run command options
    const runCmd = program.commands.find((c) => c.name() === 'run');
    assert.ok(runCmd);
    const runOptionFlags = runCmd.options.map((o) => o.flags);
    assert.ok(runOptionFlags.some((f) => f.includes('--offline')));
    assert.ok(runOptionFlags.some((f) => f.includes('--no-cache')));
  });
});

