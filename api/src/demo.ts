// Demo sandboxes (docs/09-demo.md): every visitor of "Demoni ochish" gets an own org with sample data, a live
// message simulator while someone is watching, and simulated calls. All names and numbers are fake (+998 00 ...).
import { SYSTEM, tx, type Q } from "./db.js";
import { hashPassword, token } from "./auth.js";
import { createOrg } from "./orgs.js";
import { watched } from "./bus.js";
import { handleInbound } from "./flow.js";
import { periodStart } from "./billing/usage.js";
import type { ChannelRow, Kind } from "./channels/adapters.js";

const NAMES = ["Dilnoza Rahimova", "Aziz Valiyev", "Jasur Toshmatov", "Nodira Karimova", "Sardor Mirzayev", "Kamola Aliyeva", "Bobur Sobirov", "Gulnora Xasanova",
  "Rustam Yusupov", "Malika Olimova", "Sherzod Qodirov", "Zarina Usmonova", "Otabek Nurmatov", "Feruza Ismoilova", "Ulug'bek Sattorov", "Madina Ergasheva", "Javohir Rasulov", "Shahnoza Tursunova"];
const phone = (i: number) => `+998 00 ${String(100 + ((i * 37) % 900))} ${String(10 + ((i * 13) % 90))} ${String(10 + ((i * 7) % 90))}`;
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

type Script = { kind: Kind; stage: string; interest: string | null; value: number | null; next: string | null; dueH: number | null; summary: string | null; mode: "ai" | "human"; op: number | null; msgs: [string, string][] };
// [author, text]: c = contact, a = ai, u = operator, s = system
const SCRIPTS: Script[] = [
  { kind: "telegram", stage: "yangi", interest: null, value: null, next: null, dueH: null, summary: null, mode: "ai", op: null, msgs: [["c", "Assalomu alaykum, kurslaringiz bormi?"], ["a", "Assalomu alaykum! Namuna Servis yordamchisi Zarina. Qaysi yo'nalish qiziqtiryapti?"]] },
  { kind: "instagram", stage: "qiziqdi", interest: "o'rta", value: 1_200_000, next: "Narx ro'yxatini yuborish", dueH: null, summary: "Mijoz narx bilan qiziqdi. (AI Zarina)", mode: "ai", op: null, msgs: [["c", "Salom, narxlar qancha?"], ["a", "Narx xizmat turiga va hajmga bog'liq. Qaysi xizmat kerakligini va telefon raqamingizni yozsangiz, aniq hisob-kitobni yuboramiz."], ["c", "Konditsioner o'rnatish, 2 ta xonaga"]] },
  { kind: "whatsapp", stage: "uchrashuv", interest: "yuqori", value: 2_400_000, next: "Uchrashuvni tasdiqlash, bir kun oldin eslatma", dueH: 20, summary: "Mijoz ertaga soat 11:00 ga kelishdi. (AI Zarina)", mode: "ai", op: null, msgs: [["c", "Assalomu alaykum, usta qachon kela oladi?"], ["a", "Assalomu alaykum! Qaysi kun va soat qulay?"], ["c", "ertaga soat 11 da bo'ladimi?"], ["a", "Ajoyib! Ertaga soat 11:00 ga yozib qo'ydim. Bir kun oldin eslatma yuboramiz."]] },
  { kind: "telegram", stage: "qiziqdi", interest: "yuqori", value: 3_500_000, next: "Qo'ng'iroq qilish", dueH: 2, summary: "Mijoz raqamini qoldirdi, qo'ng'iroq kutyapti. (AI Zarina)", mode: "human", op: 1, msgs: [["c", "Ofis uchun 5 ta kompyuter kerak, chegirma bormi?"], ["a", "Narx hajmga bog'liq. Telefon raqamingizni qoldirsangiz, menejer aniq taklif beradi."], ["c", "+998 00 412 55 67"], ["a", "Rahmat! Menejerimiz shu raqamga tez orada qo'ng'iroq qiladi."], ["u", "Assalomu alaykum, men Mohira. 15 daqiqada qo'ng'iroq qilaman."]] },
  { kind: "sms", stage: "qayta", interest: "o'rta", value: null, next: "Qayta bog'lanish", dueH: 30, summary: "Mijoz keyinroq gaplashishni so'radi. (AI Zarina)", mode: "ai", op: null, msgs: [["c", "Hozir bandman, keyinroq yozaman"], ["a", "Mayli, qachon qulay? Kun va soatni yozing, o'sha paytda bog'lanamiz."]] },
  { kind: "widget", stage: "yangi", interest: null, value: null, next: null, dueH: null, summary: null, mode: "ai", op: null, msgs: [["c", "Ish vaqtingiz qanaqa?"], ["a", "Biz har kuni 09:00–18:00 ishlaymiz. Uchrashuv uchun qulay kun va soatni yozing, manzilni yuboramiz."]] },
  { kind: "instagram", stage: "yutildi", interest: "yuqori", value: 4_800_000, next: null, dueH: null, summary: "Shartnoma imzolandi, oldindan to'lov qilindi.", mode: "human", op: 2, msgs: [["c", "Kecha gaplashgan edik, shartnomani yuboring"], ["u", "Yubordim, tekshirib ko'ring. Rahmat!"], ["c", "Imzoladim, to'lov qildim 👍"]] },
  { kind: "whatsapp", stage: "yutqazildi", interest: "past", value: null, next: null, dueH: null, summary: "Mijoz hozircha rad etdi. (AI Zarina)", mode: "ai", op: null, msgs: [["c", "Qimmat ekan, kerak emas"], ["a", "Tushundim, rahmat! Kerak bo'lsa shu yerga yozing, doim yordam beramiz."]] },
  { kind: "telegram", stage: "qiziqdi", interest: "yuqori", value: 900_000, next: "Operator javob beradi", dueH: 1, summary: "Mijoz operator bilan gaplashmoqchi. (AI Zarina)", mode: "human", op: null, msgs: [["c", "Kafolat necha yil? Operator bilan gaplashsam bo'ladimi"], ["a", "Albatta, sizni operatorga ulayman. Bir daqiqa kuting."], ["s", "Zarina suhbatni operatorga topshirdi."]] },
  { kind: "sms", stage: "uchrashuv", interest: "yuqori", value: 1_700_000, next: "Uchrashuvni tasdiqlash", dueH: 50, summary: "Qo'ng'iroqdan keyin juma kuni ko'rikka yozildi.", mode: "human", op: 1, msgs: [["u", "Namuna Servis: juma 15:00 ko'rik tasdiqlandi."], ["c", "Rahmat, boraman"]] },
];

const OPENERS = ["Assalomu alaykum, narxlar qancha?", "Salom, xizmatlaringiz haqida ma'lumot bering", "Yetkazib berish bormi?", "Assalomu alaykum, bugun ishlaysizmi?", "Chegirma bormi hozir?", "Qayerda joylashgansiz?"];
const FOLLOW = ["+998 00 {p}", "ertaga soat 15 da qulay", "operator bilan gaplashsam bo'ladimi", "keyinroq yozaman, hozir bandman", "2 ta xonaga kerak, qancha bo'ladi?"];

export async function createDemo(): Promise<{ userId: string; orgId: string }> {
  const pw = await hashPassword(token());
  return tx(SYSTEM, async (q) => {
    const tag = token(6).toLowerCase().replace(/[^a-z0-9]/g, "x");
    const user = await q.one<{ id: string }>("insert into users(email, name, password_hash, demo) values ($1, 'Demo foydalanuvchi', $2, true) returning id", [`demo-${tag}@demo.operobot2`, pw]);
    const orgId = await createOrg(q, "Namuna Servis", user.id, { plan: "pro", demo: true });
    await seed(q, orgId, pw, tag);
    return { userId: user.id, orgId };
  });
}

async function seed(q: Q, orgId: string, pw: string, tag: string) {
  const ops: string[] = [];
  for (const [i, n] of ["Mohira", "Umid"].entries()) {
    const u = await q.one<{ id: string }>("insert into users(email, name, password_hash, demo) values ($1, $2, $3, true) returning id", [`${n.toLowerCase()}-${tag}@demo.operobot2`, n, pw]);
    await q.exec("insert into memberships(org_id, user_id, role, last_seen_at) values ($1, $2, $3, $4)", [orgId, u.id, i ? "operator" : "admin", ago(5 + i * 40)]);
    ops.push(u.id);
  }
  const chans: Record<string, string> = {};
  for (const [kind, name] of [["telegram", "@namuna_servis_bot"], ["whatsapp", "WhatsApp Business"], ["instagram", "@namuna.servis"], ["sms", "SMS 1234"]] as const) {
    const c = await q.one<{ id: string }>("insert into channels(org_id, kind, name, status, secret, info) values ($1,$2,$3,'demo',$4,'Demo kanal: xabarlar tashqariga chiqmaydi') returning id", [orgId, kind, name, token(18)]);
    chans[kind] = c.id;
  }
  chans.widget = (await q.one<{ id: string }>("select id from channels where org_id = $1 and kind = 'widget'", [orgId])).id;
  await q.exec("insert into agents(org_id, name, kind, prompt, greeting, voice, replies, handoffs) values ($1, 'Sardor', 'voice', $2, $3, 'erkak · ishonchli', 46, 9)",
    [orgId, "Chiquvchi qo'ng'iroqda aksiyani qisqa aytib bering. Mijoz qiziqsa 1 ni bosishni yoki 'ha' deyishni so'rang va operatorga ulang.", "Assalomu alaykum! Namuna Servisdan qo'ng'iroq qilyapmiz, sizga kuzgi aksiya haqida aytmoqchimiz."]);
  await q.exec("update agents set replies = 128, handoffs = 14 where org_id = $1 and name = 'Zarina'", [orgId]);
  const stages = new Map((await q.many<{ id: string; key: string }>("select id, key from stages where org_id = $1", [orgId])).map((s) => [s.key, s.id]));

  for (const [i, s] of SCRIPTS.entries()) {
    const start = 10 + i * 47 + (s.msgs.length * 3);
    const contact = await q.one<{ id: string }>(
      "insert into contacts(org_id, name, phone, username, channel, external_id, created_at, last_seen_at, tags) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
      [orgId, NAMES[i], s.kind === "sms" || s.kind === "whatsapp" || i % 3 === 0 ? phone(i) : null, s.kind === "telegram" || s.kind === "instagram" ? NAMES[i].split(" ")[0].toLowerCase() + (i + 7) : null,
        s.kind, `demo-${i}`, ago(start + 60), ago(start - s.msgs.length * 3), i % 4 === 0 ? ["VIP"] : []]);
    const conv = await q.one<{ id: string }>(
      "insert into conversations(org_id, contact_id, channel_id, mode, assignee_id, created_at, status) values ($1,$2,$3,$4,$5,$6,$7) returning id",
      [orgId, contact.id, chans[s.kind], s.mode, s.op ? ops[s.op - 1] : null, ago(start + 1), s.stage === "yutildi" || s.stage === "yutqazildi" ? "closed" : "open"]);
    const lead = await q.one<{ id: string }>(
      `insert into leads(org_id, contact_id, conversation_id, stage_id, title, value, interest, next_action, due_at, assignee_id, source, summary, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
      [orgId, contact.id, conv.id, stages.get(s.stage), `${NAMES[i].split(" ")[0]} · ${s.kind}`, s.value, s.interest, s.next, s.dueH ? new Date(Date.now() + s.dueH * 3600_000).toISOString() : null,
        s.op ? ops[s.op - 1] : null, s.kind, s.summary, ago(start + 1), ago(start - s.msgs.length * 3)]);
    let t = start, last = "", dir = "in", firstReply: string | null = null;
    for (const [a, text] of s.msgs) {
      const author = a === "c" ? "contact" : a === "a" ? "ai" : a === "u" ? "user" : "system";
      dir = author === "contact" ? "in" : "out";
      if (dir === "out" && author !== "system" && !firstReply) firstReply = ago(t);
      await q.exec("insert into messages(org_id, conversation_id, direction, author, user_id, text, status, at) values ($1,$2,$3,$4,$5,$6,$7,$8)",
        [orgId, conv.id, dir, author, author === "user" ? ops[(s.op ?? 1) - 1] : null, text, dir === "in" ? "received" : "demo", ago(t)]);
      last = text; t -= 2 + (i % 3);
    }
    const unread = dir === "in" ? 1 + (i % 2) : 0;
    await q.exec("update conversations set lead_id = $2, last_text = $3, last_at = $4, last_dir = $5, unread = $6, first_in_at = $7, first_reply_at = $8 where id = $1",
      [conv.id, lead.id, last, ago(t + 2), dir, unread, ago(start), firstReply]);
  }

  // calls: one finished campaign + one running (simulated) campaign
  const voice = await q.one<{ id: string }>("select id from agents where org_id = $1 and kind = 'voice'", [orgId]);
  const done = await q.one<{ id: string }>("insert into campaigns(org_id, name, status, agent_id, created_at) values ($1, 'Oktabr: eski mijozlar', 'done', $2, $3) returning id", [orgId, voice.id, ago(60 * 26)]);
  const outcomes = ["connected", "no_answer", "declined", "connected", "busy", "no_answer", "connected", "answered", "declined", "connected", "no_answer", "connected"];
  for (const [i, st] of outcomes.entries()) {
    const c = await q.one<{ id: string }>("insert into contacts(org_id, name, phone, channel, created_at) values ($1,$2,$3,'manual',$4) returning id", [orgId, NAMES[(i + 5) % NAMES.length], phone(40 + i), ago(60 * 26)]);
    const dur = st === "connected" ? 50 + i * 11 : st === "declined" || st === "answered" ? 15 : 0;
    await q.exec("insert into calls(org_id, campaign_id, contact_id, status, duration_sec, started_at, ended_at, summary, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$6)",
      [orgId, done.id, c.id, st, dur, ago(60 * 25 - i * 6), ago(60 * 25 - i * 6 - 1), st === "connected" ? "Mijoz 1 ni bosdi, operator bilan gaplashdi." : st === "declined" ? "Mijoz 2 ni bosdi: qiziqmaydi." : null]);
  }
  const run = await q.one<{ id: string }>("insert into campaigns(org_id, name, status, agent_id) values ($1, 'Kuzgi aksiya', 'running', $2) returning id", [orgId, voice.id]);
  for (let i = 0; i < 14; i++) {
    const c = await q.one<{ id: string }>("insert into contacts(org_id, name, phone, channel) values ($1,$2,$3,'manual') returning id", [orgId, NAMES[(i + 9) % NAMES.length], phone(70 + i)]);
    await q.exec("insert into calls(org_id, campaign_id, contact_id) values ($1,$2,$3)", [orgId, run.id, c.id]);
  }
  await q.exec("insert into usage(org_id, period, messages, ai_replies, call_seconds) values ($1, $2, 1840, 612, 9480)", [orgId, periodStart()]);
  await q.exec("insert into invoices(org_id, plan, months, amount, provider, status, created_at, paid_at) values ($1, 'pro', 1, 449000, 'payme', 'paid', $2, $2)", [orgId, ago(60 * 24 * 9)]);
}

/** While a demo org is watched: every ~25 s a new customer writes or an open AI conversation continues. */
export function startDemoSimulator(): void {
  setInterval(() => void simTick().catch((e) => console.warn("[demo]", (e as Error).message)), 25_000).unref();
  setInterval(() => void cleanup().catch((e) => console.warn("[demo] tozalash", (e as Error).message)), 10 * 60_000).unref();
}

let seq = 0;
async function simTick() {
  const orgs = await tx(SYSTEM, (q) => q.many<{ id: string }>("select id from orgs where demo and created_at > now() - interval '24 hours'"));
  for (const o of orgs) {
    if (!watched(o.id) || Math.random() < 0.35) continue;
    const pickChan = await tx(o.id, (q) => q.many<ChannelRow>("select * from channels where org_id = $1", [o.id]));
    const open = await tx(o.id, (q) => q.maybe<{ channel_id: string; external_id: string; name: string; n: number }>(
      `select v.channel_id, c.external_id, c.name, (select count(*)::int from messages m where m.conversation_id = v.id and m.direction = 'in') n
       from conversations v join contacts c on c.id = v.contact_id
       where v.org_id = $1 and v.mode = 'ai' and v.status = 'open' and c.external_id like 'sim-%' and v.last_dir = 'out'
       order by random() limit 1`, [o.id]));
    seq++;
    if (open && open.n < 4 && Math.random() < 0.6) {
      const ch = pickChan.find((c) => c.id === open.channel_id)!;
      const text = FOLLOW[(seq + open.n) % FOLLOW.length].replace("{p}", `${100 + (seq % 900)} ${10 + (seq % 90)} ${20 + (seq % 70)}`);
      await handleInbound(ch, { externalId: open.external_id, name: open.name, text });
    } else {
      const ch = pickChan[seq % pickChan.length];
      await handleInbound(ch, { externalId: `sim-${Date.now()}`, name: NAMES[(seq * 5) % NAMES.length], text: OPENERS[seq % OPENERS.length], phone: ch.kind === "sms" || ch.kind === "whatsapp" ? phone(200 + seq) : undefined });
    }
  }
}

async function cleanup() {
  await tx(SYSTEM, async (q) => {
    const n = await q.exec("delete from orgs where demo and created_at < now() - interval '24 hours'");
    await q.exec("delete from users u where demo and not exists (select 1 from memberships m where m.user_id = u.id)");
    if (n) console.log(`[demo] ${n} ta eski sandbox o'chirildi`);
  });
}
