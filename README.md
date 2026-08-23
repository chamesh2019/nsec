# zVault (NullSec)

<div align="center">

[![pnpm](https://img.shields.io/badge/pnpm-9.0.0-orange?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/Turborepo-cached-000000?logo=turborepo&logoColor=white)](https://turbo.build/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Fastify](https://img.shields.io/badge/Server-Fastify%205-000000?logo=fastify&logoColor=white)](https://fastify.dev/)

**Zero-Knowledge Secret Vault & Runtime Process Injector for Modern Engineering Teams & CI/CD**

[Quickstart](#quickstart) • [Features](#key-features) • [CLI Cheatsheet](#cli-command-reference) • [Monorepo Packages](#monorepo-packages) • [Security Model](#security--cryptography-architecture) • [Development](#local-development)

</div>

---

## Overview

**zVault** (NullSec) is a zero-knowledge secret management platform engineered for exceptional developer experience, strict cryptographic security, and frictionless execution.

Unlike traditional secret managers that require storing secrets in plaintext `.env` files or hardcoding vendor SDKs throughout your codebase, zVault operates on a **zero production dependency** model:
- Decrypts project secrets in **client memory** using your local cryptographic keys.
- Directly injects decrypted secrets into the spawned process's `process.env`.
- Stores user keys securely in your **OS Keyring** (macOS Keychain, Linux Secret Service, Windows Credential Manager).
- The server stores only encrypted ciphertext blobs and envelope keys; **the server never sees plaintext secrets or private keys.**

---

## Key Features

- 🔒 **2-Tier Zero-Knowledge Envelope Encryption**: Secrets are encrypted using symmetric `AES-256-GCM` with a unique Project Master Key ($PK$), which in turn is encrypted individually for each member using asymmetric `RSA-OAEP 4096` / `Ed25519` keypairs.
- 🚀 **Zero Production Dependencies (`nsec run`)**: Execute any application command (`npx nsec run -- npm run dev`) with secrets securely populated into `process.env` at runtime. No `.env` files on disk.
- 🔑 **Native OS Keyring Storage**: User private keys and identities reside in macOS Keychain, Linux Secret Service / Keyutils, or Windows Credential Manager, with permission-locked (`0o600`) file fallback for headless environments.
- 👥 **Team Key Sharing & Instant Revocation**: Add teammates by encrypting the Project Master Key with their public key. Revoking a member automatically rotates the project key and re-encrypts the secret payload.
- 🤖 **CI/CD Service Tokens**: Generate scoped service tokens for automated deployment pipelines and runner environments without human keyrings.
- ⚡ **Multi-Runtime Backend**: Fastify Node.js server with support for edge deployments via Cloudflare Workers + D1 database (`apps/server-cloudflare`).
- 📦 **Programmatic SDK**: Optional `@nsec/sdk` for dynamic runtime secret resolution and rotation hooks in Node.js applications.

---

## Quickstart

### 1. Register Local Identity

Generate your Ed25519 signing keypair and RSA-4096 encryption keypair, securely store them in your OS Keyring, and publish your public identity to the server:

```bash
npx nsec register alice@example.com
```

### 2. Initialize a Project

Initialize zVault in your repository root. This generates a random 256-bit symmetric Master Project Key, encrypts it with your public key, and publishes the project metadata:

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

Or for a Next.js / Vite / Node app:

```bash
npx nsec run -e staging -- node server.js
```

---

## CLI Command Reference

The CLI is available under the aliases `nsec`, `zvault`, and `nullsec`.

| Command | Arguments / Flags | Description |
| :--- | :--- | :--- |
| `nsec run` | `-- <command...>`<br>`-e, --env <env>`<br>`--storage <mode>`<br>`--no-keyring` | Fetches, decrypts secrets in memory, and spawns the target command with injected `process.env`. |
| `nsec register` | `<email>`<br>`-s, --server <url>`<br>`--storage <mode>` | Generates local Ed25519/RSA keys in OS Keyring and registers public keys on the server. Alias: `nsec login`. |
| `nsec whoami` | `-s, --server <url>`<br>`--storage <mode>` | Displays current identity, server connection, active project, and cryptographic key fingerprints. |
| `nsec keys` | `--storage <mode>` | Lists all stored project key identities on this machine. |
| `nsec init` | `-p, --project <name>`<br>`-s, --server <url>`<br>`-e, --email <email>`<br>`--storage <mode>` | Initializes a new project, creates local keypairs, and registers the project envelope. |
| `nsec set` | `<key> <value>`<br>`-e, --env <env>` | Encrypts and uploads a secret variable for the target environment. |
| `nsec get` | `[key]`<br>`-e, --env <env>` | Decrypts and displays one or all secret variables in client memory. |
| `nsec migrate` | `<file>`<br>`-e, --env <env>`<br>`--storage <mode>`<br>`--dry-run` | Migrates secrets from a `.env` file into NullSec and redacts values in place. |
| `nsec member add` | `<email>`<br>`-r, --role <role>`<br>`-e, --environments <envs>` | Shares the Project Master Key with a team member using their registered public key. |
| `nsec token create`| `-e, --env <env>`<br>`-n, --name <name>` | Generates a scoped machine service token for CI/CD pipelines and headless servers. |

---

## Monorepo Packages

This repository is organized as a high-performance monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/repo).

```
zvault/
├── apps/
│   ├── docs/                   # Nextra & Next.js documentation portal (@zvault/docs)
│   └── server-cloudflare/      # Server implementation for Cloudflare Workers & D1 (@nsec/server-cloudflare)
├── packages/
│   ├── cli/                    # CLI executable binary: nsec / zvault (@nsec/cli)
│   ├── core/                   # Shared DTOs, Zod schemas, HTTP API client (@nsec/core)
│   ├── crypto/                 # Zero-knowledge cryptographic primitives (@nsec/crypto)
│   ├── keyring/                # OS Keyring and credential storage abstraction (@nsec/keyring)
│   ├── sdk/                    # Programmatic Node.js SDK (@nsec/sdk)
│   └── server/                 # Fastify REST API backend (@nsec/server)
├── docs/                       # Superpowers specs, plans, and architectural designs
├── package.json                # Workspace root manifest
├── pnpm-workspace.yaml         # pnpm workspace definition
└── turbo.json                  # Turborepo task pipeline configuration
```

### Package Directory

| Package | Purpose | Dependencies |
| :--- | :--- | :--- |
| [`@nsec/cli`](file:///home/chames/Projects/zvault/packages/cli) | Binary executable for CLI commands (`nsec`, `zvault`, `nullsec`). | `@nsec/core`, `@nsec/crypto`, `@nsec/keyring`, `commander` |
| [`@nsec/core`](file:///home/chames/Projects/zvault/packages/core) | Shared TypeScript types, Zod configuration validators, and typed HTTP API client. | `@nsec/crypto`, `zod` |
| [`@nsec/crypto`](file:///home/chames/Projects/zvault/packages/crypto) | Pure cryptographic envelope encryption (`AES-256-GCM`), RSA-4096 OAEP, and Ed25519 signing. | Native Node.js `crypto` |
| [`@nsec/keyring`](file:///home/chames/Projects/zvault/packages/keyring) | Cross-platform OS Keyring store (macOS Keychain, Linux Secret Service, Windows Credential Manager) and fallback file store. | `@napi-rs/keyring` |
| [`@nsec/sdk`](file:///home/chames/Projects/zvault/packages/sdk) | Optional client library for programmatic secret loading and runtime hooks. | `@nsec/core`, `@nsec/crypto` |
| [`@nsec/server`](file:///home/chames/Projects/zvault/packages/server) | Fastify REST API server managing user public keys, encrypted envelope blobs, and memberships. | `fastify`, `@fastify/cors`, `@nsec/core`, `@nsec/crypto` |
| [`@nsec/server-cloudflare`](file:///home/chames/Projects/zvault/apps/server-cloudflare) | Edge server implementation tailored for Cloudflare Workers with D1 SQL storage. | `hono`, `@nsec/core`, `@nsec/crypto`, `@nsec/server` |
| [`@zvault/docs`](file:///home/chames/Projects/zvault/apps/docs) | Interactive documentation web app built with Nextra and Next.js. | `next`, `nextra`, `react` |

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

zVault adheres to a strict Zero-Knowledge 2-tier Envelope Encryption model:

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
2. **Multi-User Key Sharing (Envelope)**: $PK$ is encrypted with each team member's public key (`RSA-OAEP 4096` / `ECDH`). The server stores `(projectId, environment, userId) -> encryptedProjectKey`.
3. **User Identity Keypair**: Each developer has an `Ed25519` keypair (for request authentication & signing) and `RSA-4096` keypair (for envelope key decryption), saved exclusively in their local **OS Keyring**.
4. **Zero Knowledge Assurance**: Even in the event of a full server database breach, attackers only obtain encrypted ciphertext blobs and public keys. Without a member's private key stored in their local OS Keyring, the secrets cannot be decrypted.

---

## Local Development

### Prerequisites
- **Node.js**: `>= 18.0.0`
- **pnpm**: `>= 9.0.0` (`corepack enable && corepack prepare pnpm@latest --activate`)

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/chamesh2019/nsec.git
   cd nsec
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Build all packages and applications**:
   ```bash
   pnpm build
   ```

4. **Run the test suite across all packages**:
   ```bash
   pnpm test
   ```

5. **Start local development mode (watch mode via Turborepo)**:
   ```bash
   pnpm dev
   ```

6. **Start the Fastify API Server locally**:
   ```bash
   pnpm --filter @nsec/server dev
   ```

7. **Run the Documentation Site**:
   ```bash
   pnpm --filter @zvault/docs dev
   ```

---

## License

This project is licensed under the [MIT License](LICENSE).
