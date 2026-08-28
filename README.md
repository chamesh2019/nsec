# NullSec (zVault)

<div align="center">

[![pnpm](https://img.shields.io/badge/pnpm-9.0.0-orange?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/Turborepo-cached-000000?logo=turborepo&logoColor=white)](https://turbo.build/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Hono](https://img.shields.io/badge/Server-Hono%204-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose%20Ready-2496ED?logo=docker&logoColor=white)](apps/server-docker)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers%20%2B%20D1-F38020?logo=cloudflare&logoColor=white)](apps/server-cloudflare)

**Zero-Knowledge Secret Vault, Web Admin Dashboard & Runtime Process Injector for Modern Engineering Teams & CI/CD**

[Quickstart](#quickstart) • [Key Features](#key-features) • [Web Admin Dashboard](#web-administration-dashboard) • [CLI Cheatsheet](#cli-command-reference) • [Deployments](#self-hosted-deployments) • [Security Model](#security--cryptography-architecture) • [Packages](#monorepo-packages)

</div>

---

## Overview

**NullSec** (zVault) is a zero-knowledge secret management platform engineered for exceptional developer experience, strict cryptographic security, and frictionless execution.

Unlike traditional secret managers that require storing secrets in plaintext `.env` files or hardcoding vendor SDKs throughout your codebase, NullSec operates on a **zero production dependency** model:
- Decrypts project secrets in **client memory** using your local cryptographic keys.
- Directly injects decrypted secrets into the spawned process's `process.env`.
- Stores user keys securely in your **OS Keyring** (macOS Keychain, Linux Secret Service, Windows Credential Manager).
- Serves a **Zero-Knowledge Web Admin Dashboard** using local cryptographic signature login handoff.
- The server stores only encrypted ciphertext blobs and envelope keys; **the server never sees plaintext secrets or private keys.**

---

## Key Features

- 🔒 **2-Tier Zero-Knowledge Envelope Encryption**: Secrets are encrypted symmetrically using `AES-256-GCM` with a unique Project Master Key ($PK$), which in turn is encrypted individually for each member using asymmetric `RSA-OAEP-4096` / `Ed25519` keypairs.
- 🚀 **Zero Production Dependencies (`nsec run`)**: Execute any application command (`npx nsec run -- npm run dev`) with secrets securely populated into `process.env` at runtime. No `.env` files on disk.
- 💻 **Web Admin Dashboard (`nsec dashboard`)**: Manage server users, roles, and single-use invite tokens through a dark glassmorphic web UI with zero-knowledge cryptographic signature login.
- 🔑 **Native OS Keyring Storage**: User private keys and identities reside in macOS Keychain, Linux Secret Service / Keyutils, or Windows Credential Manager, with permission-locked (`0o600`) file fallback for headless environments.
- 🎫 **Single-Use Invite Tokens & Key Rotation**: Control server registration via signed invite tokens (`ns_inv_...`) and rotate keys cryptographically (`nsec rotate-keys`) without identity overwrite risks.
- ⚡ **Offline Secrets Caching**: Robust fallback caching engine for `nsec run` that keeps applications running seamlessly even when the server is offline or unreachable.
- 🐳 **1-Click Self-Hosted Deployments**: Unified **Hono** engine with built-in **SQLite** (`node:sqlite`) for Docker Compose, plus native edge support for **Cloudflare Workers + D1**.
- 🤖 **CI/CD Service Tokens**: Generate scoped service tokens (`zv_st_...`) for automated deployment pipelines and runner environments without human keyrings.
- 📦 **Programmatic SDK**: Optional `@nsec/sdk` for dynamic runtime secret resolution and rotation hooks in Node.js applications.

---

## Quickstart

### 1. Register Local Identity

Generate your Ed25519 signing keypair and RSA-4096 encryption keypair, securely store them in your OS Keyring, and register on the server:

```bash
# First registered user automatically becomes the Server Administrator
npx nsec register alice@example.com --server http://localhost:4000

# Subsequent users register with an invite token issued by an admin
npx nsec register bob@example.com --token ns_inv_xxx --server http://localhost:4000
```

### 2. Initialize a Project

Initialize NullSec in your repository root. This generates a random 256-bit symmetric Master Project Key, encrypts it with your public key, and publishes the project metadata:

```bash
npx nsec init -p my-awesome-app
```

### 3. Add Secrets

Store encrypted environment variables for your active environment (`development`, `staging`, or `production`):

```bash
npx nsec set DATABASE_URL "postgres://postgres:secret@localhost:5432/mydb"
npx nsec set STRIPE_SECRET_KEY "sk_test_51Mz..."
npx nsec set JWT_SECRET "super-secret-key-123"
```

To view current secrets in client memory:

```bash
npx nsec get
```

### 4. Run Any Application with Injected Secrets

Spawn your application process. `nsec run` retrieves the encrypted payload, decrypts it in memory, and passes the plaintext variables into the child process environment:

```bash
npx nsec run -- npm run dev
```

Or for a Next.js / Vite / Node app in a specific environment:

```bash
npx nsec run -e staging -- node server.js
```

---

## Web Administration Dashboard

Launch the zero-knowledge Web Administration Dashboard from your terminal:

```bash
nsec dashboard
```

- **Cryptographic Signature Login Handoff**: The CLI signs a short-lived, nonced ticket locally with your private key and opens `https://<server>/dashboard#auth=<ticket>`.
- **Zero-Knowledge URL Fragment Transport**: The `#auth=` hash fragment is extracted by client-side JS and immediately cleared from the address bar, keeping credentials out of server access logs and browser history.
- **Server Management**:
  - Live overview metrics (Total Users, Server Admins, Pending Invites, Projects).
  - Searchable user table with 1-click **Promote to Admin** / **Demote to Member**.
  - Invite token management with 1-click **Copy Registration Command** and instant revocation.
  - Strict security boundary: secret ciphertext and decryption keys are never loaded into the browser.

---

## Self-Hosted Deployments

### Option A: 1-Click Docker Compose (Persistent SQLite)

Deploy NullSec anywhere in seconds using Docker Compose and Node.js built-in SQLite (`node:sqlite`):

```bash
cd apps/server-docker
docker compose up -d
```

- Live at `http://localhost:4000`.
- Data is persisted in named volume `nullsec_data` (`/data/nullsec.db`).
- Zero external database setup required.

### Option B: Cloudflare Workers + D1 (Serverless Edge)

Deploy NullSec to Cloudflare's global edge network backed by Cloudflare D1 SQL:

```bash
cd apps/server-cloudflare
wrangler d1 execute nullsec-db --file=./schema.sql
wrangler deploy
```

---

## CLI Command Reference

The CLI is available under the aliases `nsec`, `zvault`, and `nullsec`.

| Command | Arguments / Flags | Description |
| :--- | :--- | :--- |
| `nsec run` | `-- <command...>`<br>`-e, --env <env>`<br>`--offline`<br>`--no-cache`<br>`--storage <mode>` | Fetches, decrypts secrets in memory, and spawns the target command with injected `process.env`. |
| `nsec register` | `<email>`<br>`-t, --token <token>`<br>`-s, --server <url>`<br>`--storage <mode>` | Generates local Ed25519/RSA keys in OS Keyring and registers public keys on the server. |
| `nsec dashboard` | `-s, --server <url>`<br>`--no-open` | Opens the Web Admin Dashboard with zero-knowledge cryptographic signature login. |
| `nsec invite` | `<email>`<br>`-r, --role <role>`<br>`--expires-in <days>` | Generates a single-use invite token and outputs a shareable registration command (admin only). |
| `nsec rotate-keys` | `-s, --server <url>`<br>`--storage <mode>` | Generates a new cryptographic keypair and updates public keys on the server using existing signature auth. |
| `nsec admin users` | `-s, --server <url>` | Lists all registered users on the server (admin only). |
| `nsec admin promote` | `<email>`<br>`-s, --server <url>` | Promotes a server user to Administrator role (admin only). |
| `nsec admin demote` | `<email>`<br>`-s, --server <url>` | Demotes an administrator to Member role (admin only). |
| `nsec admin invites` | `-s, --server <url>` | Lists all active and pending invite tokens (admin only). |
| `nsec admin revoke-invite` | `<inviteId>`<br>`-s, --server <url>` | Revokes an active invite token (admin only). |
| `nsec whoami` | `-s, --server <url>`<br>`--storage <mode>` | Displays current identity, server connections, active project, and cryptographic key fingerprints. |
| `nsec keys` | `--storage <mode>` | Lists all stored project key identities on this machine. |
| `nsec init` | `-p, --project <name>`<br>`-s, --server <url>`<br>`-e, --email <email>` | Initializes a new project, creates local keypairs, and registers the project envelope. |
| `nsec set` | `<key> <value>`<br>`-e, --env <env>` | Encrypts and uploads a secret variable for the target environment. |
| `nsec get` | `[key]`<br>`-e, --env <env>` | Decrypts and displays one or all secret variables in client memory. |
| `nsec migrate` | `<file>`<br>`-e, --env <env>`<br>`--dry-run` | Migrates secrets from a `.env` file into NullSec and redacts values in place. |
| `nsec member add` | `<email>`<br>`-r, --role <role>`<br>`-e, --environments <envs>` | Shares the Project Master Key with a team member using their registered public key. |
| `nsec token create`| `-e, --env <env>`<br>`-n, --name <name>` | Generates a scoped machine service token for CI/CD pipelines and headless servers. |

---

## Monorepo Packages

```
zvault/
├── apps/
│   ├── docs/                   # Documentation portal (@zvault/docs)
│   ├── server-cloudflare/      # Server deployment for Cloudflare Workers & D1 (@nsec/server-cloudflare)
│   └── server-docker/          # 1-click Docker Compose deployment with SQLite (@nsec/server-docker)
├── packages/
│   ├── cli/                    # CLI executable binary: nsec / zvault (@nsec/cli)
│   ├── core/                   # Shared DTOs, Zod schemas, HTTP API client (@nsec/core)
│   ├── crypto/                 # Zero-knowledge cryptographic primitives (@nsec/crypto)
│   ├── keyring/                # OS Keyring and credential storage abstraction (@nsec/keyring)
│   ├── sdk/                    # Programmatic Node.js SDK (@nsec/sdk)
│   └── server/                 # Unified Hono REST API & Web Dashboard backend (@nsec/server)
├── CHANGELOG.md                # Project version history and release notes
├── package.json                # Workspace root manifest
├── pnpm-workspace.yaml         # pnpm workspace definition
└── turbo.json                  # Turborepo task pipeline configuration
```

---

## Programmatic SDK Usage

For Node.js backends that prefer loading secrets dynamically at application boot rather than via CLI wrapper:

```typescript
import { ZVault } from '@nsec/sdk';

// Initialize client
const vault = new ZVault({
  project: 'my-awesome-app',
  env: 'production',
  serverUrl: 'https://api.zvault.dev'
});

// Option 1: Populate process.env dynamically
await vault.injectEnv();
console.log(process.env.DATABASE_URL);

// Option 2: Retrieve individual secrets
const dbUrl = await vault.getSecret('DATABASE_URL');
const allSecrets = await vault.getAllSecrets();
```

---

## Security & Cryptography Architecture

NullSec adheres to a strict Zero-Knowledge 2-tier Envelope Encryption model:

```
                           ┌────────────────────────┐
                           │   Plaintext Secrets    │
                           │(DATABASE_URL, API_KEY) │
                           └───────────┬────────────┘
                                       │
                               Encrypted with AES-256-GCM
                               (Project Master Key: PK)
                                       │
                                       ▼
                           ┌────────────────────────┐
                           │ Encrypted Secrets Blob │ (Stored on Server)
                           └────────────────────────┘

          ┌────────────────────────────┼────────────────────────────┐
          │                            │                            │
   Encrypted with RSA/EC       Encrypted with RSA/EC       Encrypted with RSA/EC
   User A Public Key           User B Public Key           User C Public Key
          │                            │                            │
          ▼                            ▼                            ▼
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│Encrypted PK (User A) │     │Encrypted PK (User B) │     │Encrypted PK (User C) │
└──────────────────────┘     └──────────────────────┘     └──────────────────────┘
          │                            │                            │
  (All encrypted Project Key copies stored in Server `project_keys` table)
```

1. **Project Master Key ($PK$)**: A cryptographically random 256-bit symmetric key (`AES-256-GCM`) generated locally per environment. Used to encrypt and decrypt the project secrets payload. The server never receives $PK$ in plaintext.
2. **Multi-User Key Sharing (Envelope)**: $PK$ is encrypted with each team member's public key (`RSA-OAEP 4096`). The server stores `(projectId, environment, userId) -> encryptedProjectKey`.
3. **User Identity Keypair**: Each developer has an `Ed25519` keypair (for request authentication & signing) and `RSA-4096` keypair (for envelope key decryption), saved exclusively in their local **OS Keyring**.
4. **Zero Knowledge Assurance**: Even in the event of a full server database breach, attackers only obtain encrypted ciphertext blobs and public keys. Without a member's private key stored in their local OS Keyring, the secrets cannot be decrypted.

---

## Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Build all packages
pnpm build

# 3. Run test suite across all packages
pnpm test

# 4. Start local development mode (watch mode via Turborepo)
pnpm dev

# 5. Start the Server locally (with SQLite persistence)
DATABASE_PATH=./dev.db pnpm --filter @nsec/server dev
```

---

## License

This project is licensed under the [MIT License](LICENSE).
