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
- Runner har 3 soniyada tekshiradi. Kampaniyada 1 liniya (v0.1): keyingi qo'ng'iroq oldingisining natijasi kelgach boshlanadi. 30 daqiqada natija kelmasa, qo'ng'iroq `failed` bilan yopiladi.
- **Rozilik**: haqiqiy kampaniya yaratishda ro'yxat rozilik berganini tasdiqlash shart (kim, qachon: `campaigns.consent_by`, `consent_at`); tasdiqsiz kampaniya terilmaydi.
- **Qora ro'yxat**: «2» bosgan (`declined`) raqam o'zi tushadi, panelda (kontakt kartasi) qo'lda ham qo'shiladi. Raqam bo'yicha ishlaydi: kampaniyaga qo'shilmaydi, navbatda bo'lsa `blocked` bo'ladi.
- **Demo tashkilot**: qo'ng'iroq simulyatsiya qilinadi (javob bermadi / band / 2 / 1 → operator), telefon tarmog'iga hech narsa chiqmaydi.
- **Haqiqiy tashkilot**: `POST {DIALER_URL}/originate {callId, phone, callback}` → natija `POST /api/hooks/dialer/<orgId>.<hook_secret> {callId, status, durationSec, summary}`. Javob 2xx: kutiladi. 400 yoki 422: raqam rad etildi, `failed`. Qolgani (javob yo'q, 5xx, 401, 404, 409, 429): raqam navbatga qaytadi, 15 soniyadan keyin qayta so'raladi, shuning uchun dialer `callId` bo'yicha takrorni tanishi kerak. Takror natija ikkinchi marta hisoblanmaydi. `status`: `connected`, `operator_busy` (1 ni bosdi, operator ulanmadi: lid «qayta» bosqichiga), `answered`, `declined`, `no_answer`, `busy`, `failed`. Dialer tomoni: [operobot docs/04 §Kampaniya API](https://github.com/dtwinuz/operobot/blob/main/docs/04-dialer.md#kampaniya-api). `DIALER_URL` = ichki manzil, `DIALER_TOKEN` = dialer'dagi `CAMPAIGN_TOKEN`, dialer'dagi `CAMPAIGN_CALLBACK_ORIGIN` = `PUBLIC_URL`.
- Qonuniy oyna: `max(9, work_from) ≤ soat < min(18, work_to)` Toshkent vaqti, yakshanba va bayramda yo'q (operobot dialer bilan bir xil; hayitlar `.env` `HOLIDAYS` da, har yili yangilanadi). Faqat demo tashkilot chetlab o'tadi.

## MCP

`POST /api/mcp`, `Authorization: Bearer ob2_…` (Sozlamalar → API kalit). Tool'lar: `lidlar`, `lid_yangilash`, `suhbatlar`, `suhbat_tarixi`, `xabar_yuborish`, `statistika`. Claude Desktop / Claude Code'da «Custom connector» sifatida qo'shiladi.
