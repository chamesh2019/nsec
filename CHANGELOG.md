# Changelog

All notable changes to the NullSec / zVault project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2026-08-28

### Added
- **Web Administration Dashboard**:
  - Zero-knowledge cryptographic login handoff (`nsec dashboard`) that signs a timestamped and nonced login ticket with the administrator's local Ed25519 keypair.
  - Fragment-based `#auth=<ticket>` URL transport that keeps login tickets out of server access logs and browser history.
  - Session authentication routes (`POST /api/v1/auth/session`, `GET /api/v1/auth/session/me`, `DELETE /api/v1/auth/session`) supporting HttpOnly cookies and bearer tokens with replay protection.
  - Modern dark glassmorphic Single-Page Application (SPA) dashboard served directly from `@nsec/server` on `/dashboard` and `/dashboard/*`.
- **Server Administration & Roles**:
  - Introduced server-level roles (`admin` | `member`) distinct from project-level roles.
  - First registered user automatically becomes the server administrator.
  - Support for `NSEC_BOOTSTRAP_TOKEN` for headless or automated admin registration.
  - Admin CLI commands: `nsec admin users`, `nsec admin promote`, `nsec admin demote`, `nsec admin invites`, `nsec admin revoke-invite`.
- **Single-Use Invite Token System**:
  - Admin-generated invite tokens (`nsec invite <email> --role <role> --expires-in <days>`) using the `ns_inv_${id}_${secret}` format.
  - Server-side SHA-256 token hashing (`invite_tokens` table) with expiration and instant consumption upon registration.
  - `nsec register <email> --token <token>` for invite-based onboarding.
- **Cryptographic Key Rotation & Overwrite Prevention**:
  - Added `nsec rotate-keys` (`POST /api/v1/auth/rotate-keys`) requiring authentication with existing Ed25519 signing keys.
  - Returns `409 Conflict` on duplicate registration attempts to prevent identity takeover.
- **Unified Server Engine on Hono**:
  - Migrated `@nsec/server` from Fastify to **Hono** + `@hono/node-server`.
  - Single source of truth for all routes, middleware, and dashboard across Node.js, Docker, and Cloudflare Workers.
- **Built-in SQLite Database Adapter (`SqliteDatabaseAdapter`)**:
  - Native SQLite storage using Node.js built-in `node:sqlite` (`DatabaseSync`), requiring zero external database services or native build dependencies.
  - Automatic relational schema initialization on startup.
  - Configurable via `DATABASE_PATH` or `SQLITE_PATH`.
- **Standalone Docker Compose Deployment (`apps/server-docker`)**:
  - 1-click self-hosted deployment package with multi-stage Dockerfile (`node:22-alpine`), `docker-compose.yml`, persistent volume `/data`, and automated healthcheck probes.
- **Offline Secrets Caching**:
  - Encrypted client-side cache for `nsec run` allowing applications to start smoothly during server or network outages (`--offline`, `--no-cache`).
- **Multi-Server Keyring Architecture**:
  - Support for managing credentials across multiple distinct NullSec servers without key collisions.

---

## [0.2.0] - 2026-08-28

### Added
- Multi-server keyring support in `@nsec/keyring`.
- Dotenv migration command (`nsec migrate`) to import and redact `.env` files.
- CI/CD machine service tokens (`zv_st_...`) for automated environments.
- Initial Cloudflare Workers + D1 database integration (`apps/server-cloudflare`).

---

## [0.1.0] - 2026-08-20

### Added
- Initial release of NullSec / zVault.
- 2-Tier Zero-Knowledge envelope encryption engine (`AES-256-GCM` + `RSA-OAEP-4096` + `Ed25519`).
- Native OS Keyring storage for macOS Keychain, Linux Secret Service, and Windows Credential Manager.
- CLI process injection runtime (`nsec run`).
- Project and team secret sharing.
