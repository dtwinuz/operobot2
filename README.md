# operobot2

O'zbekistondagi biznes uchun **AI sotuv va call-markaz SaaS**: barcha kanallardagi murojaatlar bitta inbox'da, AI agent 24/7 javob beradi va lid yaratadi, chiquvchi qo'ng'iroqda mijoz «1» ni bossa operatorga ulanadi.

[![ci](https://github.com/dtwinuz/operobot2/actions/workflows/ci.yml/badge.svg)](https://github.com/dtwinuz/operobot2/actions/workflows/ci.yml)
![node](https://img.shields.io/badge/node-24-339933)
![react](https://img.shields.io/badge/react-19-61dafb)
![postgres](https://img.shields.io/badge/postgres-17%20RLS-336791)
![til](https://img.shields.io/badge/til-uz%20%C2%B7%20ru%20%C2%B7%20en-0891b2)

**[Sayt](https://operobot2.dtwin.uz) · [Jonli demo](https://wonmor.io/demo/operobot2/) · [Hujjatlar](docs/) · [Holat](STATUS.md)**

![Bosh sahifa: bugungi xabar, AI javob, qo'ng'iroq va voronka](docs/screenshots/01-dashboard.jpg)

## Nima qiladi

- **Omnikanal inbox** — Telegram, WhatsApp, Instagram, SMS va sayt vidjeti bitta ro'yxatda; filtr, qidiruv, operatorga biriktirish, AI qoralama.
- **AI agent** — kompaniya ko'rsatmasi bo'yicha javob beradi, ism / telefon / uchrashuv vaqtini ajratadi, kalit so'zda operatorga uzatadi.
- **CRM doska** — 6 bosqichli voronka, lidlar suhbatdan avtomatik tushadi, sudrab yoki ro'yxatdan ko'chiriladi.
- **Chiquvchi qo'ng'iroq** — kampaniya, [`operobot`](https://github.com/dtwinuz/operobot) dialer (Asterisk ARI), qonuniy oyna 09:00–18:00, qora ro'yxat, rozilik.
- **Ko'p mijozli** — har tashkilot ma'lumoti PostgreSQL RLS bilan alohida; rollar egasi / admin / operator.
- **Tarif va to'lov** — 4 tarif, limitlar, Payme va Click, hisob-fakturalar.
- **MCP** — 6 tool (lidlar, suhbatlar, xabar yuborish, statistika), Claude'ga «Custom connector» sifatida ulanadi.

## Skrinshotlar

| | |
|---|---|
| ![Inbox](docs/screenshots/02-inbox.jpg) | ![Doska](docs/screenshots/03-board.jpg) |
| Inbox: AI suhbat, kontakt va lid kartasi yonma-yon | Doska: 34 lid 6 bosqichda, qiymat va keyingi qadam |
| ![Kontaktlar](docs/screenshots/05-contact-card.jpg) | ![Qo'ng'iroqlar](docs/screenshots/06-calls.jpg) |
| Kontakt kartasi: lidlar, suhbatlar, qo'ng'iroqlar tarixi | Kampaniyalar va jonli qo'ng'iroqlar jurnali |
| ![Yangi kampaniya](docs/screenshots/07-campaign-new.jpg) | ![AI agentlar](docs/screenshots/08-agents.jpg) |
| Yangi kampaniya: raqamlar ro'yxati va rozilik | AI agent sozlamasi va sinab ko'rish chati |
| ![Kanallar](docs/screenshots/09-channels.jpg) | ![Tarif](docs/screenshots/11-billing.jpg) |
| Kanallar: ulangan, demo va xato holatlari | Tarif, limit sarfi, Payme / Click |
| ![Jamoa](docs/screenshots/10-team.jpg) | ![Sozlamalar](docs/screenshots/12-settings.jpg) |
| Jamoa: rollar va oxirgi kirish | Ish vaqti, API kaliti, MCP ulash |
| ![Landing](docs/screenshots/13-landing.jpg) | ![Inbox, qorong'i](docs/screenshots/15-inbox-dark.jpg) |
| Landing sahifa | Qorong'i mavzu |
| ![English](docs/screenshots/16-dashboard-en.jpg) | ![Telefon](docs/screenshots/17-phone.jpg) |
| Interfeys uz / ru / en | Telefonda inbox |

## Tez boshlash

```bash
docker run -d --name ob2-pg -e POSTGRES_USER=ob2 -e POSTGRES_PASSWORD=ob2local -e POSTGRES_DB=ob2 -p 127.0.0.1:15499:5432 postgres:17-alpine
(cd api && npm ci && DATABASE_URL=postgres://ob2:ob2local@127.0.0.1:15499/ob2 DEMO=true npx tsx src/index.ts) &
(cd web && npm ci && npm run dev)   # http://localhost:4392
```

Faqat interfeysni ko'rish uchun backend kerak emas — statik demo:

```bash
cd web && npm ci && npm run build:demo && npm run serve:demo   # http://127.0.0.1:47312/demo/operobot2/
```

Statik demo'da API brauzer xotirasidan javob beradi (`web/src/mock`), simulyator yangi xabar va qo'ng'iroqlarni o'zi qo'shadi; o'zgarishlar qayta yuklanganda tiklanadi. Kirish: `demo@namuna.uz` / `demo`.

## Ishlatish

Sayt vidjeti (Kanallar → Sayt vidjeti → kalit):

```html
<script src="https://operobot2.dtwin.uz/widget.js" data-key="wk_..."></script>
```

MCP (Sozlamalar → API kalit):

```json
{ "mcpServers": { "operobot2": { "type": "http", "url": "https://operobot2.dtwin.uz/api/mcp", "headers": { "Authorization": "Bearer ob2_..." } } } }
```

To'liq API: [docs/04-api.md](docs/04-api.md), modullar: [docs/05-modullar.md](docs/05-modullar.md).

## Hujjatlar

| # | |
|---|---|
| [00](docs/00-maqsad.md) | Maqsad, operobot bilan farqi, qoidalar |
| [01](docs/01-imkoniyatlar.md) | Imkoniyatlar matritsasi |
| [02](docs/02-arxitektura.md) | Arxitektura va xabar oqimi |
| [03](docs/03-malumot-modeli.md) | Ma'lumot modeli |
| [04](docs/04-api.md) | API shartnomasi |
| [05](docs/05-modullar.md) | Kanallar, AI agent, qo'ng'iroqlar, MCP |
| [06](docs/06-deploy.md) | Lokal ishga tushirish va deploy |
| [07](docs/07-xavfsizlik.md) | Xavfsizlik va qonun (09:00–18:00, ZRU-547) |
| [08](docs/08-tarif.md) | Tarif va to'lov |
| [09](docs/09-demo.md) | Demo sandbox va statik demo |
| [10](docs/10-yol-xaritasi.md) | Yo'l xaritasi |
| [ADR](docs/adr/) | 0001 alohida repo · 0002 RLS · 0003 stek |

## Ishlab chiqish

```
api/        Fastify API, sql/ migratsiyalar, Dockerfile
web/        React panel + landing, src/mock (statik demo), public/widget.js
deploy/     docker-compose.yml, Caddyfile, deploy.sh
docs/       00–10 hujjatlar, adr/, screenshots/
```

```bash
cd api && npm run build              # typecheck + build
cd web && npm run build              # prod build (demo kodi kirmaydi)
cd web && npm run test:demo          # statik demo smoke e2e (Playwright, 17 test)
cd web && npm run site:screenshots   # docs/screenshots/ ni qayta yaratadi
```

Stek: Node 24 + TypeScript, Fastify, PostgreSQL 17 (RLS), React 19 + Vite. CI: typecheck + build.
