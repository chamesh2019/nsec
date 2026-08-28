import { Command } from 'commander';
import {
  executeRun,
  executeInit,
  executeRegister,
  executeInvite,
  executeRotateKeys,
  executeDashboard,
  executeListUsers,
  executePromoteUser,
  executeDemoteUser,
  executeListInvites,
  executeRevokeInvite,
  executeWhoami,
  executeListKeys,
  executeSet,
  executeGet,
  executeAddMember,
  executeCreateToken,
  executeMigrate
} from './commands/index.js';


export * from './runner.js';
export * from './commands/index.js';
export * from './cache.js';

export const CLI_VERSION = '0.3.0';


export function buildCliProgram(): Command {
  const program = new Command();

  program
    .name('nsec')
    .description('NullSec - Zero-knowledge secret vault for secure process injection and team management')
    .version(CLI_VERSION);

  // 1. zvault run -- <command...>
  program
    .command('run')
    .description('Fetch and decrypt secrets in memory, then spawn target process with injected process.env')
    .option('-e, --env <environment>', 'Target project environment (e.g. development, staging, production)')
    .option('--storage <mode>', 'Credential store mode: keyring, file, memory')
    .option('--no-keyring', 'Bypass OS Keyring and use file storage')
    .option('--offline', 'Run offline using locally cached encrypted secrets')
    .option('--no-cache', 'Bypass reading and writing to secrets cache')
    .argument('<command...>', 'Command and arguments to execute')
    .allowUnknownOption()
    .action(async (commandArgs, options) => {
      try {
        const storageMode = options.keyring === false ? 'file' : options.storage;
        const exitCode = await executeRun({
          env: options.env,
          configOverride: storageMode ? { storage: storageMode } : undefined,
          offline: Boolean(options.offline),
          noCache: options.cache === false,
          command: commandArgs
        });
        process.exit(exitCode);
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  // 2. nsec register <email> / nsec login <email>
  program
    .command('register <email>')
    .alias('login')
    .description('Generate local cryptographic keys in OS Keyring and register your public key with the server')
    .option('-s, --server <url>', 'NullSec Server URL')
    .option('-t, --token <token>', 'Invite token or server bootstrap token')
    .option('--storage <mode>', 'Credential storage mode (keyring | file)')
    .action(async (email, options) => {
      try {
        const res = await executeRegister(email, {
          serverUrl: options.server,
          token: options.token,
          storage: options.storage
        });
        const roleStr = res.role ? ` (${res.role})` : '';
        console.log(`\x1b[32m✔ Registered identity "${res.email}"${roleStr} with ${res.serverUrl}\x1b[0m`);
        console.log(`\x1b[32m✔ Private keys saved in local ${options.storage || 'keyring'}\x1b[0m`);
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  // 3. nsec invite <email>
  program
    .command('invite <email>')
    .description('Generate a single-use invite token for a new user (admin only)')
    .option('-r, --role <role>', 'Server role for the invitee (admin | member)', 'member')
    .option('-s, --server <url>', 'NullSec Server URL')
    .option('--days <days>', 'Invite expiration in days (e.g. 7)')
    .option('--storage <mode>', 'Credential storage mode')
    .action(async (email, options) => {
      try {
        const days = options.days ? parseInt(options.days, 10) : undefined;
        const res = await executeInvite(email, {
          role: options.role,
          serverUrl: options.server,
          expiresInDays: days,
          storage: options.storage
        });
        console.log(`\n\x1b[32m✔ Created invite for "${res.email}" (${res.role})\x1b[0m`);
        console.log(`\n\x1b[1mShare this command with the invitee:\x1b[0m`);
        console.log(`  \x1b[36m${res.registrationCommand}\x1b[0m\n`);
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  // 4. nsec rotate-keys
  program
    .command('rotate-keys')
    .description('Generate a new cryptographic keypair and update your public keys on the server')
    .option('-s, --server <url>', 'NullSec Server URL')
    .option('--storage <mode>', 'Credential storage mode')
    .action(async (options) => {
      try {
        const res = await executeRotateKeys({
          serverUrl: options.server,
          storage: options.storage
        });
        console.log(`\x1b[32m✔ Cryptographic keys rotated for "${res.email}" on ${res.serverUrl}\x1b[0m`);
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  // 5. nsec dashboard
  program
    .command('dashboard')
    .description('Open the web administration dashboard with zero-knowledge cryptographic signature login')
    .option('-s, --server <url>', 'NullSec Server URL')
    .option('--storage <mode>', 'Credential store mode')
    .option('--no-open', 'Do not automatically launch system browser')
    .action(async (options) => {
      try {
        const res = await executeDashboard({
          serverUrl: options.server,
          storage: options.storage,
          noOpen: options.open === false
        });
        console.log(`\n\x1b[32m✔ Authenticated dashboard URL generated for "${res.email}":\x1b[0m`);
        console.log(`\n  \x1b[36m\x1b[1m${res.dashboardUrl}\x1b[0m\n`);
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  // 6. nsec admin <command>
  const adminCmd = program.command('admin').description('Server administration and user management (admin only)');


  adminCmd
    .command('users')
    .description('List all registered users on the server')
    .option('-s, --server <url>', 'Server URL')
    .option('--storage <mode>', 'Credential store mode')
    .action(async (options) => {
      try {
        const users = await executeListUsers({ serverUrl: options.server, storage: options.storage });
        console.log(`\n\x1b[1mRegistered Server Users (${users.length}):\x1b[0m`);
        for (const u of users) {
          const roleTag = u.role === 'admin' ? '\x1b[33m[admin]\x1b[0m' : '[member]';
          console.log(`  • \x1b[36m${u.email}\x1b[0m ${roleTag} (created ${u.createdAt.slice(0, 10)})`);
        }
        console.log('');
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  adminCmd
    .command('promote <email>')
    .description('Promote a user to server administrator')
    .option('-s, --server <url>', 'Server URL')
    .option('--storage <mode>', 'Credential store mode')
    .action(async (email, options) => {
      try {
        const user = await executePromoteUser(email, { serverUrl: options.server, storage: options.storage });
        console.log(`\x1b[32m✔ Promoted "${user.email}" to admin\x1b[0m`);
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  adminCmd
    .command('demote <email>')
    .description('Demote an administrator to regular member')
    .option('-s, --server <url>', 'Server URL')
    .option('--storage <mode>', 'Credential store mode')
    .action(async (email, options) => {
      try {
        const user = await executeDemoteUser(email, { serverUrl: options.server, storage: options.storage });
        console.log(`\x1b[32m✔ Demoted "${user.email}" to member\x1b[0m`);
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  adminCmd
    .command('invites')
    .description('List pending invite tokens')
    .option('-s, --server <url>', 'Server URL')
    .option('--storage <mode>', 'Credential store mode')
    .action(async (options) => {
      try {
        const invites = await executeListInvites({ serverUrl: options.server, storage: options.storage });
        console.log(`\n\x1b[1mPending Invites (${invites.length}):\x1b[0m`);
        if (invites.length === 0) {
          console.log(`  (No pending invites)\n`);
        } else {
          for (const inv of invites) {
            console.log(`  • \x1b[36m${inv.email}\x1b[0m (${inv.role}) - ID: ${inv.id} (invited by ${inv.invitedBy})`);
          }
          console.log('');
        }
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  adminCmd
    .command('revoke-invite <id>')
    .description('Revoke a pending invite token')
    .option('-s, --server <url>', 'Server URL')
    .option('--storage <mode>', 'Credential store mode')
    .action(async (id, options) => {
      try {
        await executeRevokeInvite(id, { serverUrl: options.server, storage: options.storage });
        console.log(`\x1b[32m✔ Revoked invite "${id}"\x1b[0m`);
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });


  // 3. nsec whoami
  program
    .command('whoami')
    .description('Display current local identity, server connection, and key fingerprints')
    .option('-s, --server <url>', 'Server URL to check')
    .option('--storage <mode>', 'Credential store mode')
    .action(async (options) => {
      try {
        const res = await executeWhoami({
          serverUrl: options.server,
          storage: options.storage
        });

        if (res.isMultiServer && res.identities.length > 1) {
          console.log(`\n\x1b[1mNullSec Registered Server Identities (${res.identities.length}):\x1b[0m`);
          for (const id of res.identities) {
            console.log(`\n  \x1b[1m• Server:\x1b[0m          \x1b[36m${id.serverUrl}\x1b[0m`);
            console.log(`    Email:           \x1b[32m${id.userEmail || '(unregistered or offline)'}\x1b[0m`);
            console.log(`    Storage:         ${id.storage}`);
            if (id.signingKeyFingerprint) {
              console.log(`    Signing Key:     SHA256:${id.signingKeyFingerprint} (Ed25519)`);
            }
            if (id.encryptionKeyFingerprint) {
              console.log(`    Encryption Key:  SHA256:${id.encryptionKeyFingerprint} (RSA-4096)`);
            }
          }
          console.log('');
        } else {
          console.log(`\n\x1b[1mNullSec Identity Status:\x1b[0m`);
          console.log(`  • Email:          \x1b[32m${res.userEmail || '(unregistered or offline)'}\x1b[0m`);
          console.log(`  • Project:        ${res.project}`);
          console.log(`  • Server:         ${res.serverUrl}`);
          console.log(`  • Storage:        ${res.storage}`);
          if (res.signingKeyFingerprint) {
            console.log(`  • Signing Key:    SHA256:${res.signingKeyFingerprint} (Ed25519)`);
          }
          if (res.encryptionKeyFingerprint) {
            console.log(`  • Encryption Key: SHA256:${res.encryptionKeyFingerprint} (RSA-4096)`);
          }
          console.log('');
        }
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  // 4. nsec keys (list stored credentials on this machine)
  program
    .command('keys')
    .description('List all project identities stored in local OS Keyring')
    .option('--storage <mode>', 'Credential store mode')
    .action(async (options) => {
      try {
        const keys = await executeListKeys({ storage: options.storage });
        console.log(`\n\x1b[1mStored Server Identities on this machine:\x1b[0m`);
        if (keys.length === 0) {
          console.log(`  (No keys stored yet. Run "nsec register" or "nsec init" to create keys)\n`);
        } else {
          for (const k of keys) {
            console.log(`  • \x1b[36m${k}\x1b[0m`);
          }
          console.log('');
        }
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        process.exit(1);
      }
    });

  // 5. nsec init
  program
    .command('init')
    .description('Initialize a new NullSec project, create local keypairs, and write configuration')
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
        console.log(`\x1b[32m✔ Initialized NullSec project "${res.project}"\x1b[0m`);
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

  // 5. zvault migrate <file>
  program
    .command('migrate <file>')
    .description('Migrate secrets from a .env file into NullSec and redact the values in place')
    .option('-e, --env <environment>', 'Target environment')
    .option('--storage <mode>', 'Credential store mode (keyring | file)')
    .option('--dry-run', 'Parse the file and report what would be uploaded without making changes')
    .action(async (file, options) => {
      try {
        const res = await executeMigrate({
          file,
          env: options.env,
          dryRun: options.dryRun,
          configOverride: options.storage ? { storage: options.storage } : undefined
        });
        if (res.dryRun) {
          console.log(`\x1b[33mDry run\x1b[0m — no changes made.`);
          console.log(`\nParsed ${res.uploaded.length} entries from ${res.file}:`);
          for (const key of res.uploaded) {
            console.log(`  • \x1b[36m${key}\x1b[0m`);
          }
          if (res.invalid.length > 0) {
            console.log(`\nSkipped ${res.invalid.length} malformed line(s):`);
            for (const inv of res.invalid) {
              console.log(`  • line ${inv.line}: ${inv.reason}`);
            }
          }
        } else {
          console.log(`\x1b[32m✔ Migrated ${res.uploaded.length} secret(s) to environment "${res.environment}"\x1b[0m`);
          console.log(`\x1b[32m✔ Redacted ${res.redactedCount} value(s) in ${res.file}\x1b[0m`);
        }
      } catch (err: unknown) {
        console.error(`\x1b[31mError:\x1b[0m ${(err as Error)?.message}`);
        console.error(`\x1b[33mMigration aborted. The .env file was NOT modified.\x1b[0m`);
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

const isCliEntry =
  process.argv[1] &&
  !process.argv[1].includes('test') &&
  (process.argv[1].endsWith('nsec') ||
   process.argv[1].endsWith('nullsec') ||
   process.argv[1].endsWith('zvault') ||
   process.argv[1].endsWith('index.js') ||
   process.argv[1].endsWith('index.ts'));

if (isCliEntry) {
  const program = buildCliProgram();
  program.parseAsync(process.argv);
}
