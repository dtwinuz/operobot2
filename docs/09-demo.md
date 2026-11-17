# 09 · Demo

`DEMO=true` bo'lsa landing'dagi **«Demoni ochish»** → `POST /api/auth/demo`:

1. Tashrifchiga **alohida** tashkilot «Namuna Servis» (Pro tarif) va demo foydalanuvchi yaratiladi. Boshqa tashrifchilar uni ko'rmaydi (RLS).
2. Namuna ma'lumot: 5 kanal (Telegram, WhatsApp, Instagram, SMS — demo holatda; sayt vidjeti — haqiqiy), 2 operator, chat agent Zarina va ovozli agent Sardor, 10 suhbat, 10 lid barcha bosqichlarda, tugagan va ishlayotgan qo'ng'iroq kampaniyasi, oy boshidan limit sarfi, to'langan hisob.
3. Panel ochiq turganda simulyator har ~25 soniyada yangi mijoz yozadi yoki ochiq suhbatni davom ettiradi → AI javob beradi → lid bosqichi o'zgaradi. Hammasi SSE bilan jonli.
4. «Kuzgi aksiya» kampaniyasi qo'ng'iroqlarni simulyatsiya qiladi. Natijalar lidlarga yoziladi.
5. 24 soatdan keyin sandbox butunlay o'chadi.

Sayt vidjeti demo'da ham haqiqiy: Kanallar → Sayt vidjeti → kodni istalgan sahifaga qo'ysangiz, yozilgan xabar inbox'ga tushadi va AI javob beradi.

Cheklov: har IP soatiga 10 ta sandbox. Demo foydalanuvchi parol bilan kira olmaydi (faqat shu cookie).

## Statik demo (backend'siz)

`cd web && npm run build:demo` → `web/dist-demo/`, base `/demo/operobot2/` ([jonli](https://wonmor.io/demo/operobot2/)). Xuddi shu panel, lekin `/api` va SSE brauzer xotirasidan javob beradi (`web/src/mock`: 48 kontakt, 30+ suhbat, 34 lid, 6 kampaniya, 120+ qo'ng'iroq, 5 agent, 6 kanal, 8 a'zo, hisob-fakturalar). Vaqtlar `Date.now()` ga nisbatan, o'zgarishlar qayta yuklanganda tiklanadi. Demo kodi faqat `--mode demo` da dinamik yuklanadi, oddiy `npm run build` ga kirmaydi.

- `npm run serve:demo` — lokal ko'rish, `npm run test:demo` — smoke e2e, `npm run site:screenshots` — `docs/screenshots/`.
