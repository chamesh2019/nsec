#!/usr/bin/env node
import { Command } from 'commander';
import {
  executeRun,
  executeInit,
  executeSet,
  executeGet,
  executeAddMember,
  executeCreateToken
} from './commands/index.js';

export * from './runner.js';
export * from './commands/index.js';

export const CLI_VERSION = '0.1.0';

export function buildCliProgram(): Command {
  const program = new Command();

  program
    .name('zvault')
    .description('Zero-knowledge secret vault CLI for secure process injection and management')
    .version(CLI_VERSION);

  // 1. zvault run -- <command...>
  program
    .command('run')
    .description('Fetch and decrypt secrets in memory, then spawn target process with injected process.env')
    .option('-e, --env <environment>', 'Target project environment (e.g. development, staging, production)')
    .option('--storage <mode>', 'Credential store mode: keyring, file, memory')
    .option('--no-keyring', 'Bypass OS Keyring and use file storage')
    .argument('<command...>', 'Command and arguments to execute')
    .allowUnknownOption()
    .action(async (commandArgs, options) => {
      try {
        const storageMode = options.keyring === false ? 'file' : options.storage;
        const exitCode = await executeRun({
          env: options.env,
          configOverride: storageMode ? { storage: storageMode } : undefined,
          command: commandArgs
        });
        process.exit(exitCode);
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  // 2. zvault init
  program
    .command('init')
    .description('Initialize a new zvault project, create local keypairs, and write configuration')
    .option('-p, --project <name>', 'Project identifier')
    .option('-s, --server <url>', 'Server URL')
    .option('-e, --email <email>', 'User identity email')
    .option('--storage <mode>', 'Credential storage mode (keyring | file)')
    .action(async (options) => {
      try {
        const res = await executeInit({
          project: options.project,
          serverUrl: options.server,
          email: options.email,
          storage: options.storage
        });
        console.log(`\x1b[32m✔ Initialized zvault project "${res.project}"\x1b[0m`);
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  // 3. zvault set <key> <value>
  program
    .command('set <key> <value>')
    .description('Encrypt and save a secret value for the active environment')
    .option('-e, --env <environment>', 'Target environment')
    .action(async (key, value, options) => {
      try {
        const res = await executeSet(key, value, { env: options.env });
        console.log(`\x1b[32m✔ Secret "${res.key}" updated (version ${res.version})\x1b[0m`);
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  // 4. zvault get [key]
  program
    .command('get [key]')
    .description('Decrypt and view secret values in client memory')
    .option('-e, --env <environment>', 'Target environment')
    .action(async (key, options) => {
      try {
        const res = await executeGet(key, { env: options.env });
        if (typeof res === 'string') {
          console.log(res);
        } else {
          console.table(res);
        }
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  // 5. zvault member add <email>
  const memberCmd = program.command('member').description('Manage project members and zero-knowledge key sharing');
  memberCmd
    .command('add <email>')
    .description('Share project key with a teammate via zero-knowledge public key encryption')
    .option('-r, --role <role>', 'Member role (admin | developer | viewer)', 'developer')
    .option('-e, --environments <envs>', 'Comma-separated environments to share')
    .action(async (email, options) => {
      try {
        const envs = options.environments ? options.environments.split(',') : undefined;
        await executeAddMember(email, { role: options.role, environments: envs });
        console.log(`\x1b[32m✔ Member "${email}" added to project\x1b[0m`);
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  // 6. zvault token create
  const tokenCmd = program.command('token').description('Manage CI/CD machine service tokens');
  tokenCmd
    .command('create')
    .description('Generate a scoped service token for CI/CD runners')
    .option('-e, --env <environment>', 'Target environment', 'production')
    .option('-n, --name <name>', 'Token description name')
    .action(async (options) => {
      try {
        const res = await executeCreateToken({ env: options.env, name: options.name });
        console.log(`\x1b[32m✔ Service token generated:\x1b[0m\n${res.token}`);
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  return program;
}

// Direct CLI invocation
if (import.meta.url === `file://${process.argv[1]}`) {
  const program = buildCliProgram();
  program.parseAsync(process.argv);
}
