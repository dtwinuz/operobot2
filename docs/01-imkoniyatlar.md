# 01 · Imkoniyatlar matritsasi

Manba: operatora.ai tahlili (`dtwinuz/operobot` → `research/operatora-ai/README.md`, 2026-11-04). Faqat **funksiya** taqqoslanadi.

Belgilar: ✅ v0.1 da ishlaydi · 🟡 kod bor, haqiqiy integratsiyada sinalmagan · ⏳ rejada ([10](10-yol-xaritasi.md)).

| # | Imkoniyat | operatora.ai | operobot2 | Qayerda |
|---|---|---|---|---|
| 1 | Bitta inbox: Telegram, WhatsApp, Instagram, SMS | bor | 🟡 adapterlar yozilgan, demo'da simulyatsiya | `api/src/channels/adapters.ts` |
| 2 | Sayt chat-vidjeti | — | ✅ | `web/public/widget.js`, `/api/widget/*` |
| 3 | CRM doska (Kanban), avtomatik lid | Yangi / Jarayonda / Yopildi | ✅ 6 bosqich, sudrab o'tkazish | `/api/leads`, `web` Doska |
| 4 | AI agent: yozma javob 24/7 | bor | ✅ qoida asosida, 🟡 LLM bilan | `api/src/ai/brain.ts` |
| 5 | AI → lid kartasi: qiziqish, keyingi qadam, uchrashuv vaqti | bor | ✅ | `flow.ts` `applyExtracted` |
| 6 | Operatorga topshirish (handoff), AI/operator rejimi | bor | ✅ | `runAgent`, `PATCH /conversations` |
| 7 | Operator uchun AI qoralama javob | «Javobni AI yozib beradi» | ✅ | `POST /conversations/:id/suggest` |
| 8 | Ovozli AI agent | faqat kiruvchi, «early access» | 🟡 operobot dialer'da bor (#33), ko'prik ⏳ | operobot `dialer/src/agent.ts` |
| 9 | **Chiquvchi ommaviy qo'ng'iroq** | yo'q | ✅ demo simulyatsiya, 🟡 dialer ko'prigi | `api/src/voice/calls.ts` |
| 10 | Qonuniy 09:00–18:00 qulfi | yo'q | ✅ | `callWindowOpen` |
| 11 | Real vaqt (yangi xabar, lid, qo'ng'iroq) | bor | ✅ SSE | `/api/events` |
| 12 | Tahlil: bugun, soatlar, kanallar, voronka | bor | ✅ | `/api/stats` |
| 13 | Ko'p foydalanuvchi, rollar (owner/admin/operator) | bor | ✅ | `/api/members` |
| 14 | Ko'p mijozli SaaS, ro'yxatdan o'tish | bor | ✅ RLS bilan | ADR-0002 |
| 15 | Tariflar, limitlar | 4 tarif | ✅ 4 tarif (namuna narx), oylik limit | `billing/plans.ts` |
| 16 | Payme / Click to'lovi | bor | 🟡 Payme Merchant API yozilgan, Click faqat havola | `billing/pay.ts` |
| 17 | MCP server (Claude / ChatGPT) | bor | ✅ 6 tool, org API kaliti | `api/src/mcp.ts` |
| 18 | Google Sheets sinxron | bor | ⏳ (operobot'da bor) | — |
| 19 | amoCRM / Bitrix24 | integratsiya logolari | ⏳ (operobot'da amoCRM bor) | — |
| 20 | Softphone (brauzer / mobil) | Android ilova | ⏳ (operobot `/app/` da JsSIP bor) | — |
| 21 | Qo'ng'iroq yozuvi, transkript, xulosa | bor | ⏳ (operobot dialer'da bor) | — |
| 22 | Follow-up: SMS / eslatma | bor | ⏳ (operobot'da bor) | — |
| 23 | Tillar | uz, en | uz (lug'at ajratilgan, ru/en ⏳) | `web/src/i18n.ts` |
| 24 | Tinch soatlar / ish vaqti | bor | ✅ tashkilot ish vaqti | `/api/settings` |
| 25 | Demo | video, maket | ✅ har tashrifchiga alohida sandbox | [09](09-demo.md) |
