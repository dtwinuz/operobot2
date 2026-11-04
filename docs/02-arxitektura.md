# 02 · Arxitektura

```mermaid
flowchart LR
  subgraph Mijozlar
    TG[Telegram] & WA[WhatsApp] & IG[Instagram] & SMS[SMS shlyuz] & W[Sayt vidjeti]
  end
  subgraph operobot2
    WEB[web: React SPA<br/>landing + panel] -->|/api, cookie| API
    API[api: Fastify + TS] --> PG[(PostgreSQL<br/>RLS: org_id)]
    API -->|SSE /api/events| WEB
    API --> AI[AI brain<br/>LLM yoki qoida]
  end
  TG & WA & IG & SMS -->|webhook /api/hooks/kind/secret| API
  W -->|/api/widget/key| API
  API -->|send| TG & WA & IG & SMS
  API -->|/originate| D[operobot dialer<br/>Asterisk ARI]
  D -->|/api/hooks/dialer| API
  API -->|checkout| PAY[Payme / Click]
  PAY -->|Merchant API /api/pay/payme| API
  LLM[Claude / ChatGPT] -->|MCP /api/mcp| API
```

## Kiruvchi xabar oqimi

```mermaid
sequenceDiagram
  participant K as Kanal (masalan Telegram)
  participant A as api /hooks
  participant DB as PostgreSQL (org_id)
  participant AI as AI brain
  participant P as Panel (SSE)
  K->>A: webhook (secret URL)
  A->>DB: kontakt upsert, suhbat, lid «Yangi», xabar
  A-->>P: message, conversation, lead
  A->>AI: oxirgi 20 xabar + agent ko'rsatmasi
  AI-->>A: {reply, action, extracted}
  A->>K: javob (sendMessage)
  A->>DB: lid: qiziqish, bosqich, uchrashuv vaqti
  A-->>P: message, lead, usage
  Note over A: action=handoff → suhbat «operator» rejimiga
```

## Qatlamlar

| Papka | Mas'uliyat |
|---|---|
| `api/src/db.ts` | Pool, `tx(scope, fn)`: har tranzaksiyada `app.org_id` o'rnatiladi; ilova `ob2_app` rolida ishlaydi |
| `api/src/auth.ts` | scrypt parol, sessiya tokeni (faqat sha256 saqlanadi), `req.ctx`, rollar, org API kaliti |
| `api/src/flow.ts` | Kiruvchi → lid → AI → chiquvchi; `applyExtracted` |
| `api/src/channels/` | Har kanal: `connect`, `send`, `parse` |
| `api/src/ai/brain.ts` | LLM (OpenAI-mos) yoki qoida asosidagi o'zbekcha javob |
| `api/src/voice/calls.ts` | Kampaniya navbati, qonuniy oyna, simulyatsiya yoki dialer |
| `api/src/billing/` | Tariflar, limit hisobi, checkout, Payme Merchant API |
| `api/src/mcp.ts` | MCP JSON-RPC |
| `api/src/demo.ts` | Sandbox, simulyator, 24 soatlik tozalash |
| `web/` | Landing + panel (hash router), `widget.js` |

## Kengayish

- Bitta API instansi yetadi (SSE xotirada). Bir nechta instans kerak bo'lsa: `bus.ts` → Postgres `LISTEN/NOTIFY`, kampaniya navbati → `select … for update skip locked`.
- Kanal yuborishlari hozir so'rov ichida. Hajm oshsa navbat (`outbox` jadvali + worker) qo'shiladi.
