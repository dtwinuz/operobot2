# 07 · Xavfsizlik va qonun

| Mavzu | Qaror |
|---|---|
| Tenant izolyatsiyasi | PostgreSQL RLS (`FORCE`), ilova `ob2_app` rolida; har so'rov `app.org_id` bilan. WHERE unutilsa ham boshqa tashkilot qatori qaytmaydi ([ADR-0002](adr/0002-tenancy-rls.md)) |
| Parol | scrypt (16 bayt tuz, 32 bayt kalit) |
| Sessiya | 32 bayt tasodifiy token, bazada faqat sha256; cookie `httpOnly`, `SameSite=Lax`, HTTPS'da `Secure` |
| API kalit | `ob2_<prefix>_<secret>`, faqat sha256 saqlanadi, bir marta ko'rsatiladi |
| Webhook | URL ichida tasodifiy `secret`; Payme — Basic auth `Paycom:<PAYME_KEY>` (`timingSafeEqual`) |
| Rate limit | umumiy 600/daq, login 20/15 daq, signup va demo 10/soat, vidjet 30/daq (IP bo'yicha) |
| Kanal tokenlari | `channels.config` da AES-256-GCM bilan shifrlangan, kalit `.env` dagi `CHANNEL_KEY`. Shifrlash API ichida: `pgcrypto`da kalit SQL parametri bo'lib bazaga yuborilardi. `org_id` shifrga bog'langan, boshqa tashkilot qatoriga ko'chirilgan blok ochilmaydi. Baza nusxasi o'g'irlansa tokenlar ochilmaydi, lekin server to'liq buzilsa kalit ham ochiq. Kalitni almashtirish hali yo'q |
| Demo | Soxta ism va `+998 00` raqamlar; sandbox 24 soatdan keyin o'chadi; tashqi tarmoqqa hech narsa chiqmaydi |

## Qonun (O'zbekiston)

- **Reklama qo'ng'iroqlari faqat 09:00–18:00** (2026-11-01 dan): `callWindowOpen`, haqiqiy tashkilot uchun o'chirib bo'lmaydi.
- **Shaxsiy ma'lumot lokalizatsiyasi (ZRU-547)**: O'zbekiston fuqarolari ma'lumoti O'zbekistondagi serverda. Prod uchun mahalliy VPS kerak ([06](06-deploy.md)). LLM chet elda bo'lsa suhbat matni tashqariga chiqadi → mijoz roziligi va huquqshunos fikri kerak (operobot docs/07 bilan bir xil ochiq savol).
- **Rozilik**: chiquvchi qo'ng'iroq ro'yxati faqat rozilik bergan mijozlardan bo'lishi kerak. Bu tashkilot javobgarligi: kampaniya yaratganda tasdiqlaydi, kim va qachon tasdiqlagani saqlanadi. Har bir raqam uchun alohida rozilik hali yo'q.
- **Qora ro'yxat**: «2» bosgan yoki qo'lda qo'shilgan raqamga tashkilot ichida qo'ng'iroq ketmaydi ([05](05-modullar.md#qongiroqlar)).
