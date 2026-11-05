# 04 · API shartnomasi (v0.1)

Hammasi `/api/*` ostida, JSON. Sessiya — `ob2_sid` cookie (httpOnly, SameSite=Lax, 30 kun). Sessiyali har so'rov **joriy tashkilot** (`org`) doirasida ishlaydi. PostgreSQL RLS ham shu `org_id` bo'yicha cheklaydi ([ADR-0002](adr/0002-tenancy-rls.md)).
Xato javobi: `{ "error": "matn" }` va HTTP 400/401/402/403/404/409/429. 402 tarif limiti tugaganini bildiradi.

## Auth

| Metod | Yo'l | Kirish → chiqish |
|---|---|---|
| POST | `/api/auth/signup` | `{name, email, password, company}` → `Me`. Yangi tashkilot + owner + `start` tarif |
| POST | `/api/auth/login` | `{email, password}` → `Me` |
| POST | `/api/auth/demo` | — → `Me`. Har tashrifchiga **alohida sandbox tashkilot** (namuna ma'lumot bilan, 24 soatdan keyin o'chadi). Har IP uchun soatiga 10 ta |
| POST | `/api/auth/logout` | — → `{ok:true}` |
| GET | `/api/me` | → `Me` yoki 401 |
| POST | `/api/orgs/switch` | `{orgId}` → `Me` |

```ts
type Role = 'owner' | 'admin' | 'operator'
type Me = { user: { id: string; name: string; email: string }; org: { id: string; name: string; plan: PlanKey; demo: boolean }; role: Role; orgs: { id: string; name: string; role: Role }[] }
```

## Doska (CRM)

```ts
type Stage = { id: string; key: string; name: string; color: string; position: number; kind: 'open' | 'won' | 'lost' }
type Interest = 'yuqori' | "o'rta" | 'past'
type Lead = {
  id: string; title: string; value: number | null; stageId: string; interest: Interest | null
  nextAction: string | null; dueAt: string | null; assigneeId: string | null; assigneeName: string | null
  source: Channel['kind'] | 'manual' | 'call'; summary: string | null; conversationId: string | null
  contact: { id: string; name: string; phone: string | null }; createdAt: string; updatedAt: string
}
```

| Metod | Yo'l | |
|---|---|---|
| GET | `/api/stages` | `Stage[]` (position bo'yicha) |
| GET | `/api/leads?q=&stage=` | `Lead[]` |
| POST | `/api/leads` | `{title, name, phone?, value?}` → `Lead` (kontakt yaratiladi yoki telefon bo'yicha topiladi) |
| PATCH | `/api/leads/:id` | `{stageId?, title?, value?, interest?, nextAction?, dueAt?, assigneeId?}` → `Lead` |

## Kontaktlar

```ts
type Contact = { id: string; name: string; phone: string | null; username: string | null; channel: Channel['kind'] | 'manual'; tags: string[]; createdAt: string; lastSeenAt: string | null; leads: number }
```
`GET /api/contacts?q=` → `Contact[]` · `GET /api/contacts/:id` → `Contact & { conversations: Conversation[]; calls: Call[]; leads: Lead[] }`

## Inbox (omnikanal)

```ts
type Conversation = {
  id: string; channel: Channel['kind']; channelName: string; status: 'open' | 'closed'; mode: 'ai' | 'human'
  assigneeId: string | null; assigneeName: string | null; unread: number; leadId: string | null
  contact: { id: string; name: string; phone: string | null; username: string | null }
  last: { text: string; at: string; direction: 'in' | 'out' } | null
}
type Message = { id: string; direction: 'in' | 'out'; author: 'contact' | 'ai' | 'user' | 'system'; userName: string | null; text: string; at: string; status: 'sent' | 'failed' | 'demo' | 'received' }
```

| Metod | Yo'l | |
|---|---|---|
| GET | `/api/conversations?filter=all\|unread\|mine\|ai&q=` | `Conversation[]` (oxirgi xabar bo'yicha) |
| GET | `/api/conversations/:id/messages` | `Message[]` (eski → yangi), o'qildi deb belgilaydi |
| POST | `/api/conversations/:id/messages` | `{text}` → `Message`. Kanal orqali yuboriladi, suhbat `human` rejimga o'tadi |
| PATCH | `/api/conversations/:id` | `{mode?, assigneeId?, status?}` → `Conversation` |
| POST | `/api/conversations/:id/suggest` | → `{text}`: AI tayyorlagan javob qoralamasi (yuborilmaydi) |

## Kanallar

```ts
type Channel = { id: string; kind: 'telegram' | 'whatsapp' | 'instagram' | 'sms' | 'widget'; name: string; status: 'connected' | 'demo' | 'error'; info: string | null; webhookUrl: string | null; widgetKey: string | null; createdAt: string }
```
`GET /api/channels` · `POST /api/channels {kind, name, config}` · `DELETE /api/channels/:id`.
`config`: telegram `{token}` · whatsapp `{phoneNumberId, token, verifyToken}` · instagram `{pageId, token}` · sms `{url, token, from}` · widget `{}`. Demo tashkilotda `config` bo'sh bo'lsa kanal `demo` holatda bo'ladi. `config` hech qachon javobda qaytmaydi. Serverda `CHANNEL_KEY` bo'lmasa, kalitli kanal `409` bilan rad etiladi.

## AI agentlar

```ts
type Agent = { id: string; name: string; kind: 'chat' | 'voice'; enabled: boolean; prompt: string; greeting: string; handoff: string[]; channelIds: string[]; voice: string | null; stats: { replies: number; handoffs: number } }
```
`GET /api/agents` · `POST /api/agents` · `PATCH /api/agents/:id` · `POST /api/agents/:id/test {text}` → `{reply, action: 'reply'|'handoff'|'close', extracted: {name?, phone?, interest?, meeting?}}`

## Qo'ng'iroqlar (chiquvchi kampaniya, operobot dialer)

```ts
type Campaign = { id: string; name: string; status: 'draft' | 'running' | 'paused' | 'done'; agentId: string | null; total: number; called: number; answered: number; connected: number; createdAt: string }
type Call = { id: string; campaignId: string | null; direction: 'out' | 'in'; status: 'queued' | 'dialing' | 'answered' | 'connected' | 'no_answer' | 'busy' | 'failed' | 'declined'; durationSec: number; startedAt: string | null; summary: string | null; contact: { id: string; name: string; phone: string | null } }
```
`GET /api/campaigns` · `POST /api/campaigns {name, agentId?, phones: string[]}` · `POST /api/campaigns/:id/start` · `POST /api/campaigns/:id/pause` · `GET /api/calls?campaignId=&limit=`.
Qo'ng'iroqlar faqat tashkilot ish vaqtida va **09:00–18:00 Toshkent** oralig'ida yuradi (qonun, [07](07-xavfsizlik.md)).

## Jamoa, tarif, sozlamalar

| Metod | Yo'l | |
|---|---|---|
| GET | `/api/members` | `{userId, name, email, role, lastSeenAt}[]` |
| POST | `/api/members` | `{name, email, role}` → `{member, tempPassword}` (owner/admin) |
| PATCH / DELETE | `/api/members/:userId` | `{role}` |
| GET | `/api/billing` | `Billing` |
| POST | `/api/billing/checkout` | `{plan, months: 1\|12, provider: 'payme'\|'click'}` → `{invoice, payUrl}`. Demo'da darhol to'langan |
| GET / PATCH | `/api/settings` | `{name, timezone, workFrom, workTo}` |
| POST | `/api/settings/api-key` | → `{key}` (faqat bir marta ko'rsatiladi; MCP va tashqi API uchun) |
| GET | `/api/stats` | `Stats` |

```ts
type PlanKey = 'start' | 'biznes' | 'pro' | 'korporativ'
type Limits = { operators: number; channels: number; messages: number; aiReplies: number; callMinutes: number } // -1 = cheksiz
type Plan = { key: PlanKey; name: string; priceMonth: number | null; limits: Limits; features: string[] }
type Billing = { plan: Plan; periodStart: string; periodEnd: string; usage: Limits; plans: Plan[]; invoices: { id: string; plan: PlanKey; months: number; amount: number; provider: string; status: 'pending' | 'paid' | 'failed'; createdAt: string }[] }
type Stats = {
  today: { inbound: number; outbound: number; aiReplies: number; firstReplySec: number | null; calls: number; connected: number; newLeads: number; won: number }
  byChannel: { kind: string; count: number }[]; hourly: { h: number; inbound: number; calls: number }[]
  funnel: { stageId: string; name: string; color: string; count: number }[]
}
```

## Real vaqt

`GET /api/events` — SSE. Har voqea `data: {"type": "...", "data": {...}}`. Turlari: `message` (`{conversationId, message}`), `conversation` (`Conversation`), `lead` (`Lead`), `call` (`Call`), `campaign` (`Campaign`), `usage` (`Limits`).

## Tashqi kirishlar (sessiyasiz)

| Yo'l | Kim |
|---|---|
| `POST /api/hooks/telegram/:secret` | Telegram Bot API webhook |
| `GET/POST /api/hooks/whatsapp/:secret` | WhatsApp Cloud API (GET = verify) |
| `POST /api/hooks/instagram/:secret` | Instagram Messaging webhook |
| `POST /api/hooks/sms/:secret` | SMS shlyuz kiruvchi xabari `{from, text}` |
| `POST /api/hooks/dialer/:secret` | operobot dialer natijasi `{callId, status, durationSec, pressed?, summary?}` |
| `GET/POST /api/widget/:key/messages?visitor=` | Sayt chat-vidjeti: GET → `Message[]` (bo'sh bo'lsa salomlashuv), POST `{text, page?, name?}` → yaratilgan xabar |
| `POST /api/mcp` | MCP (JSON-RPC), `Authorization: Bearer <api-key>` |
| `GET /api/health` | `{ok, db, version}` |
