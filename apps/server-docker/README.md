# NullSec Standalone Server (Docker & Docker Compose)

1-click self-hosted deployment of the NullSec zero-knowledge REST API and Web Administration Dashboard with persistent SQLite storage.

---

## Quick Start (1-Click Deployment)

### 1. Launch with Docker Compose
```bash
# Navigate to the docker app directory
cd apps/server-docker

# Start the server in the background
docker compose up -d
```

The server is now live at `http://localhost:4000` with persistent SQLite storage at named volume `nullsec_data`.

---

## 2. Register First Administrator

The first user who registers on a new NullSec server automatically becomes the **Server Administrator**.

```bash
# Register admin from your terminal
nsec register admin@yourcompany.com --server http://localhost:4000
```

---

## 3. Open Web Administration Dashboard

Launch the zero-knowledge Web Dashboard with cryptographic login handoff:

```bash
nsec dashboard --server http://localhost:4000
```

---

## Configuration & Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Host port to bind |
| `DATABASE_PATH` | `/data/nullsec.db` | Location of the persistent SQLite database file inside the container |
| `NSEC_BOOTSTRAP_TOKEN` | *(optional)* | Optional secret token for automated or emergency admin registration |

---

## Useful Commands

```bash
# View live server logs
docker compose logs -f

# Check health status
docker compose ps

# Stop the server
docker compose down

# Stop and remove database volume (CAUTION: deletes all server data)
docker compose down -v
```
