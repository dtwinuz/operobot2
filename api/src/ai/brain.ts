// AI agent brain (docs/05 §AI agent). With LLM_URL: OpenAI-compatible chat/completions returning JSON.
// Without it (demo, or LLM down): a rule-based Uzbek responder with the same output shape, so the product works offline.
import type { Config } from "../config.js";

export type Interest = "yuqori" | "o'rta" | "past";
export interface Extracted { name?: string; phone?: string; interest?: Interest; meeting?: string; stage?: "qiziqdi" | "uchrashuv" | "qayta" | "yutqazildi"; summary?: string }
export interface Decision { reply: string; action: "reply" | "handoff" | "close"; extracted: Extracted }
export interface AgentCfg { name: string; prompt: string; greeting: string; handoff: string[] }
export interface Turn { who: "contact" | "ai" | "user" | "system"; text: string }

const norm = (s: string) => s.toLowerCase().replace(/[ʻʼ‘’`´]/g, "'");
const DAYS: Record<string, number> = { dushanba: 1, seshanba: 2, chorshanba: 3, payshanba: 4, juma: 5, shanba: 6, yakshanba: 0 };

/** «ertaga soat 11» / «juma 15:00» → next such moment in Tashkent (ISO), else undefined. */
export function findMeeting(text: string, now = new Date()): string | undefined {
  const t = norm(text);
  const tash = new Date(now.getTime() + 5 * 3600_000);
  let off: number | undefined;
  if (/\bbugun\b/.test(t)) off = 0;
  if (/\bertaga\b/.test(t)) off = 1;
  for (const [d, wd] of Object.entries(DAYS)) if (new RegExp(`\\b${d}\\b`).test(t)) off = (wd - tash.getUTCDay() + 7) % 7 || 7;
  if (off === undefined) return undefined;
  const hm = /\b(\d{1,2})[:.](\d{2})\b/.exec(t) ?? /soat\s+(\d{1,2})\b/.exec(t);
  const hour = hm ? Math.min(23, Number(hm[1])) : 10;
  return new Date(Date.UTC(tash.getUTCFullYear(), tash.getUTCMonth(), tash.getUTCDate() + off, hour - 5, hm?.[2] ? Number(hm[2]) : 0)).toISOString();
}

export function findPhone(text: string): string | undefined {
  const m = /(\+?998[\s-]?)?\(?(\d{2})\)?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})\b/.exec(text);
  return m ? `+998 ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : undefined;
}

const fmt = (iso: string) => { const x = new Date(Date.parse(iso) + 5 * 3600_000).toISOString(); return `${x.slice(8, 10)}.${x.slice(5, 7)} soat ${x.slice(11, 16)}`; };

export function ruleDecide(agent: AgentCfg, history: Turn[], now = new Date()): Decision {
  const last = [...history].reverse().find((h) => h.who === "contact")?.text ?? "";
  const t = norm(last);
  const firstContact = history.filter((h) => h.who === "contact").length <= 1 && !history.some((h) => h.who === "ai");
  const ex: Extracted = {};
  const phone = findPhone(last);
  if (phone) ex.phone = phone;
  const nm = /(?:ismim|men)\s+([A-Z][a-z']{2,})/.exec(last);
  if (nm) ex.name = nm[1];
  const meeting = findMeeting(last, now);

  if ((agent.handoff.length ? agent.handoff : ["operator", "odam bilan", "menejer"]).some((k) => t.includes(norm(k))))
    return { reply: "Albatta, sizni operatorga ulayman. Bir daqiqa kuting.", action: "handoff", extracted: { ...ex, interest: "yuqori", summary: "Mijoz operator bilan gaplashmoqchi." } };
  if (/kerak emas|qiziq emas|yo'q,? rahmat|bezovta qilmang|qimmat ekan/.test(t))
    return { reply: "Tushundim, rahmat! Kerak bo'lsa shu yerga yozing, doim yordam beramiz.", action: "close", extracted: { ...ex, interest: "past", stage: "yutqazildi", summary: "Mijoz hozircha rad etdi." } };
  if (meeting)
    return { reply: `Ajoyib! ${fmt(meeting)} ga yozib qo'ydim. Bir kun oldin eslatma yuboramiz.`, action: "reply", extracted: { ...ex, meeting, interest: "yuqori", stage: "uchrashuv", summary: `Mijoz ${fmt(meeting)} ga kelishdi.` } };
  if (phone)
    return { reply: "Rahmat! Menejerimiz shu raqamga tez orada qo'ng'iroq qiladi. Qulay vaqtni ham yozib qoldirsangiz bo'ladi.", action: "reply", extracted: { ...ex, interest: "yuqori", stage: "qiziqdi", summary: "Mijoz raqamini qoldirdi, qo'ng'iroq kutyapti." } };
  if (/keyinroq|hozir band|vaqtim yo'q/.test(t))
    return { reply: "Mayli, qachon qulay? Kun va soatni yozing, o'sha paytda bog'lanamiz.", action: "reply", extracted: { ...ex, interest: "o'rta", stage: "qayta", summary: "Mijoz keyinroq gaplashishni so'radi." } };
  if (/narx|qancha|necha pul|to'lov|chegirma/.test(t))
    return { reply: "Narx xizmat turiga va hajmga bog'liq. Qaysi xizmat kerakligini va telefon raqamingizni yozsangiz, aniq hisob-kitobni yuboramiz.", action: "reply", extracted: { ...ex, interest: "o'rta", stage: "qiziqdi", summary: "Mijoz narx bilan qiziqdi." } };
  if (/manzil|qayerda|filial|ish vaqt/.test(t))
    return { reply: "Biz har kuni 09:00–18:00 ishlaymiz. Uchrashuv uchun qulay kun va soatni yozing, manzilni yuboramiz.", action: "reply", extracted: { ...ex, interest: "o'rta" } };
  if (firstContact || /assalom|salom|hayrli/.test(t))
    return { reply: agent.greeting || "Assalomu alaykum! Qanday yordam bera olaman?", action: "reply", extracted: ex };
  return { reply: "Tushundim. Batafsilroq yozsangiz yoki telefon raqamingizni qoldirsangiz, mutaxassisimiz bog'lanadi.", action: "reply", extracted: ex };
}

const SYSTEM = (a: AgentCfg, company: string, now: Date) =>
  `Siz "${company}" kompaniyasining "${a.name}" ismli AI yordamchisisiz. Mijozga qisqa (1–3 gap), xushmuomala, mijoz yozgan tilda javob bering. ` +
  `Bugun ${new Date(now.getTime() + 5 * 3600_000).toISOString().slice(0, 16)} (Toshkent). Ish vaqti 09:00–18:00.\n` +
  `Kompaniya ko'rsatmasi: ${a.prompt || "Mijozning ehtiyojini aniqlang, telefon raqami va qulay vaqtini so'rang."}\n` +
  `Mijoz operator so'rasa yoki savolga javob bilmasangiz action=handoff. Mijoz rad etsa action=close.\n` +
  `Faqat JSON: {"reply": "...", "action": "reply|handoff|close", "extracted": {"name": null, "phone": null, "interest": "yuqori|o'rta|past|null", ` +
  `"meeting": "ISO+05:00 yoki null", "stage": "qiziqdi|uchrashuv|qayta|yutqazildi|null", "summary": "1 gap yoki null"}}. Narx yoki va'dani o'ylab topmang.`;

export async function decide(cfg: Config, agent: AgentCfg, company: string, history: Turn[], now = new Date()): Promise<Decision & { ai: boolean }> {
  if (!cfg.LLM_URL) return { ...ruleDecide(agent, history, now), ai: false };
  try {
    const res = await fetch(cfg.LLM_URL, {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: { "content-type": "application/json", ...(cfg.LLM_KEY ? { authorization: `Bearer ${cfg.LLM_KEY}` } : {}) },
      body: JSON.stringify({
        model: cfg.LLM_MODEL, temperature: 0.3, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM(agent, company, now) },
          ...history.slice(-16).map((h) => ({ role: h.who === "contact" ? "user" : "assistant", content: h.who === "system" ? `[tizim] ${h.text}` : h.text })),
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const j = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as Partial<Decision>;
    const action = j.action === "handoff" || j.action === "close" ? j.action : "reply";
    const e = (j.extracted ?? {}) as Record<string, unknown>;
    const clean: Extracted = {};
    for (const k of ["name", "phone", "summary"] as const) if (typeof e[k] === "string" && e[k]) clean[k] = String(e[k]).slice(0, 300);
    if (e.interest === "yuqori" || e.interest === "o'rta" || e.interest === "past") clean.interest = e.interest;
    if (typeof e.meeting === "string" && Date.parse(e.meeting) > now.getTime()) clean.meeting = new Date(e.meeting).toISOString();
    if (["qiziqdi", "uchrashuv", "qayta", "yutqazildi"].includes(String(e.stage))) clean.stage = e.stage as Extracted["stage"];
    return { reply: String(j.reply ?? "").slice(0, 1000) || ruleDecide(agent, history, now).reply, action, extracted: clean, ai: true };
  } catch (err) {
    console.warn("[ai] LLM xato, qoida asosida:", (err as Error).message);
    return { ...ruleDecide(agent, history, now), ai: false };
  }
}
