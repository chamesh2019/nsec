# NullSec Cloudflare Worker + D1 Server

Deploy a globally-distributed, zero-knowledge secrets vault server on Cloudflare Workers backed by Cloudflare D1 (Serverless SQLite) in under 60 seconds.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nsec-io/nullsec)

---

## ⚡ 60-Second Setup via Cloudflare CLI (`wrangler`)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Create your Cloudflare D1 Database
```bash
pnpm --filter @nsec/server-cloudflare run db:create
```
*Output will display your `database_name` and `database_id`.*

### 3. Update `wrangler.toml`
Paste the `database_id` into `apps/server-cloudflare/wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "nullsec-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 4. Initialize Database Schema
```bash
# Execute schema remotely on Cloudflare D1:
pnpm --filter @nsec/server-cloudflare run db:init:remote
```

### 5. Deploy Globally
```bash
pnpm --filter @nsec/server-cloudflare run deploy
```

---

## 🚀 Connecting your NullSec CLI to your Cloudflare Server

Once deployed, your Cloudflare Worker URL (e.g. `https://nullsec-server.<your-subdomain>.workers.dev`) is live.

Initialize any project with your server:
```bash
nsec init --server https://nullsec-server.<your-subdomain>.workers.dev
```

Or set the global environment variable:
```bash
export NULLSEC_SERVER_URL="https://nullsec-server.<your-subdomain>.workers.dev"
```

---

## 🧪 Local Development & Testing

```bash
# Initialize local D1 database:
pnpm --filter @nsec/server-cloudflare run db:init:local

# Start local Cloudflare worker development server:
pnpm --filter @nsec/server-cloudflare run dev
```
Local health check: `http://localhost:8787/health`
