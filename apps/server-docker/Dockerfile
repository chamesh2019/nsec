# ==========================================
# NullSec Standalone Server Dockerfile
# Multi-stage production build with SQLite
# ==========================================

FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy monorepo configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./

# Copy packages
COPY packages/core ./packages/core
COPY packages/crypto ./packages/crypto
COPY packages/keyring ./packages/keyring
COPY packages/server ./packages/server
COPY packages/sdk ./packages/sdk

# Install dependencies and build
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@nsec/server...

# ==========================================
# Production Runner Image
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/nullsec.db

# Create data directory for SQLite persistence
RUN mkdir -p /data && chown -R node:node /data /app

# Copy built server and node_modules
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/core ./packages/core
COPY --from=builder --chown=node:node /app/packages/crypto ./packages/crypto
COPY --from=builder --chown=node:node /app/packages/server ./packages/server

USER node

EXPOSE 4000

VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/health || exit 1

CMD ["node", "packages/server/dist/index.js"]
