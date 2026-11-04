# 05 · Modullar

## Kanallar

| Kanal | Ulash (`config`) | Kiruvchi | Chiquvchi |
|---|---|---|---|
| Telegram | `token` (BotFather). Ulanishda `getMe` + `setWebhook` avtomatik | `/api/hooks/telegram/<secret>` | `sendMessage` |
| WhatsApp Cloud API | `phoneNumberId`, `token`, `verifyToken`. Webhook URL va verify token Meta kabinetiga qo'lda kiritiladi | `GET` verify + `POST /api/hooks/whatsapp/<secret>` | `/{phoneNumberId}/messages` |
| Instagram | `pageId`, `token` (Instagram Messaging, `messages` obunasi) | `/api/hooks/instagram/<secret>` | `/{pageId}/messages` |
| SMS | `url`, `token`, `from`: istalgan shlyuz (Eskiz, Play Mobile…) oldida kichik adapter | `/api/hooks/sms/<secret>` `{from, text}` | `POST url {to, text, from}` |
| Sayt vidjeti | — | `POST /api/widget/<key>/messages` | vidjet har 4 s so'raydi |

`secret` — kanalga xos tasodifiy 24 belgili satr; URL bilmagan odam xabar yubora olmaydi. Takroriy webhook (`message_id` bir xil) e'tiborsiz qoldiriladi. Credential'siz kanal `demo` holatda: xabar faqat bazaga yoziladi.

## AI agent

- Kirish: suhbatning oxirgi 20 xabari, agent `prompt`, `greeting`, `handoff` so'zlari, kompaniya nomi.
- Chiqish: `{reply, action: reply|handoff|close, extracted: {name, phone, interest, meeting, stage, summary}}`.
- `LLM_URL` bo'lsa OpenAI-mos `chat/completions` (`response_format: json_object`), xato yoki bo'lmasa — qoida asosida (salom, narx, telefon, «ertaga soat 11», «keyinroq», rad, operator).
- Har javob `usage.ai_replies` ni oshiradi. Limit tugasa suhbat operatorga o'tadi va tizim xabari yoziladi.

## Qo'ng'iroqlar

- Kampaniya = telefon ro'yxati (`+998 XX XXX XX XX` ko'rinishiga keltiriladi, takrorlar olib tashlanadi) + ixtiyoriy ovozli agent.
- Runner har 3 soniyada har ishlayotgan kampaniyadan bitta qo'ng'iroq boshlaydi (v0.1: kampaniyaga 1 liniya).
- **Demo tashkilot**: qo'ng'iroq simulyatsiya qilinadi (javob bermadi / band / 2 / 1 → operator), telefon tarmog'iga hech narsa chiqmaydi.
- **Haqiqiy tashkilot**: `POST {DIALER_URL}/originate {callId, phone, callback}` → natija `POST /api/hooks/dialer/<orgId>.<hook_secret> {callId, status, durationSec, summary}`. ⚠️ operobot dialer'da bu endpoint hali yo'q: u yerda kampaniya API'si kerak ([10](10-yol-xaritasi.md)).
- Qonuniy oyna: `max(9, work_from) ≤ soat < min(18, work_to)` Toshkent vaqti. Faqat demo tashkilot chetlab o'tadi.

## MCP

`POST /api/mcp`, `Authorization: Bearer ob2_…` (Sozlamalar → API kalit). Tool'lar: `lidlar`, `lid_yangilash`, `suhbatlar`, `suhbat_tarixi`, `xabar_yuborish`, `statistika`. Claude Desktop / Claude Code'da «Custom connector» sifatida qo'shiladi.
