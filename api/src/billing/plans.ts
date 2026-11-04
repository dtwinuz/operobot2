// Plan catalog (docs/08-tarif.md). Prices are SAMPLE numbers until the owners decide; change them here only,
// the landing page and checkout read the same list through GET /api/billing.
export type PlanKey = "start" | "biznes" | "pro" | "korporativ";
export interface Limits { operators: number; channels: number; messages: number; aiReplies: number; callMinutes: number }
export interface Plan { key: PlanKey; name: string; priceMonth: number | null; limits: Limits; features: string[] }

export const PLANS: Plan[] = [
  {
    key: "start", name: "Start", priceMonth: 0,
    limits: { operators: 1, channels: 2, messages: 300, aiReplies: 100, callMinutes: 0 },
    features: ["Inbox va doska", "2 ta kanal", "AI javob: 100 / oy", "Sayt vidjeti"],
  },
  {
    key: "biznes", name: "Biznes", priceMonth: 149_000,
    limits: { operators: 3, channels: 4, messages: 5_000, aiReplies: 2_000, callMinutes: 300 },
    features: ["3 operator", "Telegram, WhatsApp, Instagram, SMS", "AI javob: 2 000 / oy", "Chiquvchi qo'ng'iroq: 300 daqiqa", "MCP va API"],
  },
  {
    key: "pro", name: "Pro", priceMonth: 449_000,
    limits: { operators: 10, channels: -1, messages: 30_000, aiReplies: 15_000, callMinutes: 2_000 },
    features: ["10 operator", "Barcha kanallar", "AI javob: 15 000 / oy", "Ovozli AI agent", "Qo'ng'iroq: 2 000 daqiqa", "Tahlil va eksport"],
  },
  {
    key: "korporativ", name: "Korporativ", priceMonth: null,
    limits: { operators: -1, channels: -1, messages: -1, aiReplies: -1, callMinutes: -1 },
    features: ["Cheksiz", "O'z SIP trunki", "Alohida server (O'zbekistonda)", "SLA va shaxsiy menejer"],
  },
];

export const plan = (key: string): Plan => PLANS.find((p) => p.key === key) ?? PLANS[0];

/** Yearly payment is 12 months with 20% off. */
export const price = (p: Plan, months: number): number => (p.priceMonth ?? 0) * months * (months >= 12 ? 0.8 : 1);
