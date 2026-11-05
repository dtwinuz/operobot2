# STATUS

| Sana | Nima | PR |
|---|---|---|
| 2026-11-04 | Repo ochildi. v0.1: API (Fastify + PostgreSQL RLS), panel + landing (React), demo sandbox, Payme Merchant API, MCP 6 tool, Docker deploy, docs 00–10 + ADR 0001–0003 | #1 |
| 2026-11-05 | Kanal tokenlari bazada shifrlangan (`CHANNEL_KEY`) | #20 |
| 2026-11-05 | Kampaniya xavfsizligi: bitta liniya, takror natija, qora ro'yxat, rozilik, yakshanba va bayram | #21 |
| 2026-11-05 | Dialer ko'prigi: `operator_busy` holati, operobot kampaniya API bilan soxta Asterisk'da sinaldi | #22 |

## Hozirgi holat

| Blok | Holat |
|---|---|
| Ko'p mijoz, auth, rollar | ✅ lokal sinalgan (RLS izolyatsiyasi tekshirildi) |
| Inbox + AI agent (qoida) + doska | ✅ lokal, vidjet orqali haqiqiy xabar bilan |
| Telegram / WhatsApp / Instagram / SMS | 🟡 kod bor, haqiqiy token bilan sinalmagan |
| Qo'ng'iroqlar | ✅ demo simulyatsiya; 🟡 operobot dialer ko'prigi: soxta Asterisk bilan sinalgan, haqiqiy SIP'da emas |
| Tarif, limit, Payme | ✅ demo; 🟡 Payme lokal JSON-RPC bilan sinalgan, sandbox'da emas |
| MCP | ✅ lokal |
| Deploy | ✅ demo https://operobot2.dtwin.uz, brauzerda 10 sahifa va vidjet sinaldi ([06](docs/06-deploy.md)); ⏳ prod server tanlanmagan |

Keyingi ishlar: [docs/10](docs/10-yol-xaritasi.md).
