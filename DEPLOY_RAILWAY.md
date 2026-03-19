# Deploying Legal Transcribe App to Railway

## What Was Fixed

| File | Problem | Fix |
|------|---------|-----|
| `apps/web/Dockerfile` | `tsc` not found — typescript wasn't resolving from package's own node_modules | Removed `--filter` exec approach; pnpm workspace hoists `tsc` to root `node_modules` correctly |
| `apps/web/Dockerfile` | `esbuild` build scripts blocked → Vite couldn't compile | `.npmrc` already has `ignore-scripts=false`; Dockerfile now copies `.npmrc` |
| `apps/web/Dockerfile` | `pnpm-lock.yaml` absent in build 2 | `.dockerignore` was too broad — fixed to never exclude the lockfile |
| `.dockerignore` | Blocked `pnpm-lock.yaml` in some contexts | Explicit exclusions only, lockfile always included |
| `docker-compose.yml` | `DATABASE_URL` in `.env` used `localhost`, but compose services need hostname `postgres` | `environment:` block in compose now overrides with correct hostnames |
| `docker-compose.yml` | Celery root warning → fixed with `--uid=nobody` | Added `--uid=nobody --gid=nogroup` to celery command |
| `.env` | Had real `OPENAI_API_KEY` exposed | Replaced with placeholder — **regenerate your key immediately** |
| `.env` | Used `localhost` URLs | Changed to Docker service names (`postgres`, `redis`) |
| `apps/web/nginx.conf` | Missing — nginx had no SPA or API proxy config | Created with SPA fallback + `/api/` proxy + WebSocket support |

---

## Local Docker (Quickstart)

```bash
# 1. Copy and fill in secrets
cp .env.example .env
# Edit .env — set real JWT_SECRET, OPENAI_API_KEY, PYANNOTE_AUTH_TOKEN

# 2. First run (builds images, starts everything)
docker compose up --build

# 3. If Postgres credentials changed since last run, reset the volume
docker compose down -v
docker compose up --build
```

---

## Railway Deployment

Railway doesn't support `docker-compose.yml` directly. Deploy each service separately:

### Step 1 — Create a Railway Project

Go to [railway.app](https://railway.app) → New Project → Empty Project.

### Step 2 — Add Managed Services

In the Railway dashboard, add:
- **PostgreSQL** plugin → Railway auto-injects `DATABASE_URL`
- **Redis** plugin → Railway auto-injects `REDIS_URL`

### Step 3 — Deploy the API service

```
New Service → GitHub Repo → select your repo
Root Directory: apps/api
Dockerfile Path: apps/api/Dockerfile
```

Set environment variables in Railway dashboard:
```
DATABASE_URL          = ${{Postgres.DATABASE_URL}}
REDIS_URL             = ${{Redis.REDIS_URL}}
JWT_SECRET            = <generate: openssl rand -hex 32>
JWT_REFRESH_SECRET    = <generate: openssl rand -hex 32>
OPENAI_API_KEY        = sk-...
PYANNOTE_AUTH_TOKEN   = hf_...
FILE_STORAGE_PATH     = /data
WHISPER_MODEL_SIZE    = medium
PORT                  = 3001
NODE_ENV              = production
```

### Step 4 — Deploy the Celery Worker

```
New Service → GitHub Repo → select your repo (same repo, new service)
Root Directory: apps/api
Dockerfile Path: apps/api/Dockerfile
Start Command: celery -A worker.celery_app worker --loglevel=info --uid=nobody --gid=nogroup
```

Copy the same env vars as the API service (minus `PORT`).

### Step 5 — Deploy the Web frontend

```bash
New Service → GitHub Repo → select your repo
Root Directory: . (monorepo root)
Dockerfile Path: apps/web/Dockerfile
```

Set:
```
VITE_API_URL = https://<your-api-railway-domain>
```

And update your Vite app to use `import.meta.env.VITE_API_URL` as the API base URL.

### Step 6 — Volumes / File Storage

Railway doesn't have persistent volumes on the free tier. For the `uploads` volume:
- **Dev/testing**: use Railway's ephemeral storage (files lost on redeploy)
- **Production**: replace with S3/R2/Cloudflare Storage and update `FILE_STORAGE_PATH` accordingly

---

## Security Reminders

- ⚠️ **Regenerate your OpenAI API key immediately** — it was committed to `.env`
- Never commit `.env` — it's in `.gitignore` already
- Generate strong JWT secrets: `openssl rand -hex 32`
