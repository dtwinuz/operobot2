# 00 · Maqsad

**operobot2** — O'zbekistondagi kichik va o'rta biznes uchun ko'p mijozli (multi-tenant) SaaS. Bitta panelda:

| Blok | Nima qiladi |
|---|---|
| **Omnikanal inbox** | Telegram, WhatsApp, Instagram, SMS va sayt vidjetidagi barcha yozishmalar bitta ro'yxatda |
| **AI agent** | 24/7 javob beradi, ehtiyojni aniqlaydi, telefon va uchrashuv vaqtini yozib oladi, kerak bo'lsa operatorga topshiradi |
| **CRM doska** | Har murojaat avtomatik lid bo'ladi; AI bosqich, qiziqish va keyingi qadamni qo'yadi |
| **Chiquvchi qo'ng'iroq** | Ro'yxat bo'yicha avtomatik qo'ng'iroq, «1» = operator (operobot dialer). Qonuniy 09:00–18:00 qulfi kodda |
| **Tahlil** | Bugungi raqamlar, soatlar, kanallar, voronka |
| **Tarif va to'lov** | 4 tarif, oylik limitlar, Payme / Click |
| **MCP / API** | Claude va ChatGPT doska, inbox va statistikani o'qiydi va amal bajaradi |

## operobot bilan farqi

| | operobot (`dtwinuz/operobot`) | operobot2 (shu repo) |
|---|---|---|
| Kim uchun | Bitta kompaniya, o'z serverida | Ko'p kompaniya, bitta platformada |
| Asosiy ish | Google Sheet → Asterisk → «1» → operator | Murojaatlarni yig'ish → AI → lid → sotuv |
| Telefon | Dialer (ARI, SIP trunk) | Shu dialer ko'prik orqali ([05](05-modullar.md#qongiroqlar)) |
| Ma'lumot | Sheet + JSON fayllar | PostgreSQL, har jadvalda `org_id` + RLS |

## Qoidalar

1. **Raqobatchi bilan teng imkoniyat, lekin nusxa emas.** Funksiya, arxitektura va SaaS darajasi bo'yicha operatora.ai bilan tenglashamiz ([01](01-imkoniyatlar.md)). Ularning nomi, logotipi, maskoti, ranglari, matnlari va sahifa tuzilishi ko'chirilmaydi. Vizual uslub operobot oilasiniki: cyan + binafsha, Space Grotesk / Inter / JetBrains Mono.
2. **Ochiq qonuniylik.** Chiquvchi qo'ng'iroq faqat 09:00–18:00 (Toshkent), ma'lumot O'zbekistondagi serverda ([07](07-xavfsizlik.md)).
3. **Demo ishlaydi, lekin yolg'on gapirmaydi.** Hamma demo raqam `+998 00 …`, narxlar «namuna» belgili, haqiqiy integratsiyada sinalmagan narsa [10](10-yol-xaritasi.md) da ochiq yozilgan.
4. **Testlar hozircha yo'q.** CI faqat typecheck va build (operobot qoidasi bilan bir xil). Loyiha o'sganda qo'shiladi.
