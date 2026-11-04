# ADR-0001 · operobot2 alohida repo

**Holat:** qabul qilindi, 2026-11-04.

**Kontekst.** operobot — bitta kompaniya uchun chiquvchi IVR dialer (Sheet → Asterisk → operator). Egalar operatora.ai darajasidagi to'liq SaaS'ni xohlaydi: omnikanal inbox, ko'p mijoz, billing. Bu boshqa ma'lumot modeli (PostgreSQL, tenant), boshqa deploy va boshqa ritm.

**Qaror.** Yangi private repo `dtwinuz/operobot2`. operobot dialer telefon dvigateli sifatida qoladi va HTTP ko'prik orqali ulanadi ([05](../05-modullar.md#qongiroqlar)). Kod nusxalanmaydi: kerakli g'oyalar (o'zbekcha uchrashuv vaqtini topish, qonuniy oyna) qayta yoziladi.

**Oqibat.** Ikki repo parallel rivojlanadi. Dialer'ga kampaniya API kerak bo'ladi (operobot'dagi alohida PR).
