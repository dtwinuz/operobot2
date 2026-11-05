// Environment config (docs/06-deploy.md). Everything optional except DATABASE_URL; missing keys switch modules to demo mode.
import { z } from "zod";

const bool = z.enum(["true", "false", "1", "0"]).default("false").transform((v) => v === "true" || v === "1");

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().default(18300),
  PUBLIC_URL: z.string().default("http://localhost:4392"), // webhook and pay URLs are built from it
  DEMO: bool, // enables POST /api/auth/demo sandboxes and the message simulator
  SIGNUP: z.enum(["open", "closed"]).default("open"),
  // AI (OpenAI-compatible chat/completions). Without it a rule-based Uzbek responder answers.
  LLM_URL: z.string().default(""),
  LLM_KEY: z.string().default(""),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  // Payments. Without merchant ids checkout works only for demo orgs.
  PAYME_MERCHANT_ID: z.string().default(""),
  PAYME_KEY: z.string().default(""), // merchant key: Basic auth "Paycom:<key>" on POST /api/pay/payme
  CLICK_SERVICE_ID: z.string().default(""),
  CLICK_MERCHANT_ID: z.string().default(""),
  // operobot dialer bridge (docs/05). Without it calls are simulated for demo orgs only.
  DIALER_URL: z.string().default(""),
  DIALER_TOKEN: z.string().default(""),
  // Encrypts channel credentials at rest (docs/07). Without it channels with credentials cannot be added.
  CHANNEL_KEY: z.string().regex(/^([0-9a-fA-F]{64})?$/, "64 ta hex belgi kerak: openssl rand -hex 32").default(""),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env = process.env): Config {
  const r = schema.safeParse(env);
  if (!r.success) {
    console.error("config xato:", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    process.exit(1);
  }
  return r.data;
}
