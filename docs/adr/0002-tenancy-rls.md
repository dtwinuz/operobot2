# ADR-0002 · Ko'p mijozlik: bitta baza, `org_id` + RLS

**Holat:** qabul qilindi, 2026-11-04.

**Variantlar.** (a) har mijozga alohida baza; (b) alohida schema; (c) bitta schema, `org_id` ustuni.

**Qaror.** (c) + PostgreSQL Row Level Security:
- har tenant jadvalida `org_id`, `ENABLE` + `FORCE ROW LEVEL SECURITY`, policy `org_id = current_setting('app.org_id')`;
- ilova ulanishda `SET ROLE ob2_app` (superuser emas, RLS'ni chetlab o'tolmaydi);
- har so'rov `tx(orgId, fn)` ichida, `set_config('app.org_id', …, true)` tranzaksiya oxirida o'chadi;
- auth, webhook va tozalash kabi tizim ishlari `tx(SYSTEM)` (`app.bypass = on`) bilan, kodda aniq ko'rinadi.

**Nega.** Kichik mijozlar ko'p, har biriga baza qimmat. Faqat `WHERE org_id` ga tayanish xavfli: bitta unutilgan filtr boshqa kompaniya mijozlarini ochadi. RLS shu xatoni baza darajasida to'xtatadi (lokal sinov: `set role ob2_app; select count(*) from leads` → 0).

**Oqibat.** Katta mijoz uchun «Korporativ» tarifda alohida instans (o'sha kod, o'z bazasi).
