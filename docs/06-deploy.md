# 06 · Deploy

## Lokal

```bash
docker run -d --name ob2-pg -e POSTGRES_USER=ob2 -e POSTGRES_PASSWORD=ob2local -e POSTGRES_DB=ob2 -p 127.0.0.1:15499:5432 postgres:17-alpine
cd api && npm ci && DATABASE_URL=postgres://ob2:ob2local@127.0.0.1:15499/ob2 DEMO=true npx tsx src/index.ts   # :18300
cd web && npm ci && npm run dev                                                                                  # :4392, /api → :18300
```
Migratsiyalar API ishga tushganda o'zi qo'llanadi. `http://localhost:4392/` → «Demoni ochish».

## Server (Docker Compose)

| Konteyner | Vazifa |
|---|---|
| `operobot2-db` | PostgreSQL 17, volume `db` |
| `operobot2-api` | `api/Dockerfile` (Node 24), `.env` dan sozlama, faqat ichki tarmoqda |
| `operobot2-web` | Caddy: `web/dist` + `/api/*` → api (SSE uchun `flush_interval -1`) |

1. Serverda `<dir>/.env` ni [`.env.example`](../.env.example) dan yarating (`DB_PASSWORD` majburiy).
2. `bash deploy/deploy.sh <ssh-host> <dir>` — web build, fayllarni yuboradi, `docker compose up -d --build`.
3. Tashqi TLS: edge Caddy `<domen> → operobot2-web:80` (dtwin VPS'da `dtwinuz/dtwin` edge PR orqali; `EDGE_NETWORK` default `dtwin-prod_default`). `operobot2-web` portini tashqariga ochmang: API mijoz IP'sini edge qo'ygan `X-Forwarded-For` dan oladi.

| Muhit | Qayerda | Holat |
|---|---|---|
| Demo | dtwin VPS, https://operobot2.dtwin.uz | ✅ 11-05 dan ishlaydi (`/opt/operobot2`, edge route dtwinuz/dtwin#315) |
| Prod | **O'zbekistondagi VPS** (ZRU-547) | ⏳ server tanlanmagan |
