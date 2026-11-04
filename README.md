# operobot2

O'zbekistondagi biznes uchun **AI sotuv va call-markaz SaaS**: barcha kanallardagi murojaatlar bitta inbox'da, AI agent 24/7 javob beradi va lid yaratadi, CRM doska, chiquvchi qo'ng'iroq kampaniyalari (operobot dialer), tarif va to'lov, MCP.

| | |
|---|---|
| Holat | v0.1, lokal ishlaydi, demo deploy DNS kutmoqda — [STATUS](STATUS.md) |
| Stek | Node 24 + TypeScript, Fastify, PostgreSQL 17 (RLS), React 19 + Vite |
| Telefon | [`dtwinuz/operobot`](https://github.com/dtwinuz/operobot) dialer (Asterisk ARI) |

## Tuzilma

```
api/        Fastify API, sql/ migratsiyalar, Dockerfile
web/        React panel + landing, public/widget.js (sayt chat-vidjeti)
deploy/     docker-compose.yml, Caddyfile, deploy.sh
docs/       00–10 hujjatlar, adr/
```

## Hujjatlar

| # | |
|---|---|
| [00](docs/00-maqsad.md) | Maqsad, operobot bilan farqi, qoidalar |
| [01](docs/01-imkoniyatlar.md) | Imkoniyatlar matritsasi (raqobatchi bilan funksional taqqoslash) |
| [02](docs/02-arxitektura.md) | Arxitektura va xabar oqimi |
| [03](docs/03-malumot-modeli.md) | Ma'lumot modeli |
| [04](docs/04-api.md) | API shartnomasi |
| [05](docs/05-modullar.md) | Kanallar, AI agent, qo'ng'iroqlar, MCP |
| [06](docs/06-deploy.md) | Lokal ishga tushirish va deploy |
| [07](docs/07-xavfsizlik.md) | Xavfsizlik va qonun (09:00–18:00, ZRU-547) |
| [08](docs/08-tarif.md) | Tarif va to'lov |
| [09](docs/09-demo.md) | Demo sandbox |
| [10](docs/10-yol-xaritasi.md) | Yo'l xaritasi va ochiq savollar |
| [ADR](docs/adr/) | 0001 alohida repo · 0002 RLS · 0003 stek |

## Tez boshlash

```bash
docker run -d --name ob2-pg -e POSTGRES_USER=ob2 -e POSTGRES_PASSWORD=ob2local -e POSTGRES_DB=ob2 -p 127.0.0.1:15499:5432 postgres:17-alpine
(cd api && npm ci && DATABASE_URL=postgres://ob2:ob2local@127.0.0.1:15499/ob2 DEMO=true npx tsx src/index.ts) &
(cd web && npm ci && npm run dev)   # http://localhost:4392
```

CI: typecheck + build (testlar hozircha ataylab yo'q).
