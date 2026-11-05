// operobot2 API entry point (docs/02-arxitektura.md).
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { loadConfig } from "./config.js";
import { initDb, migrate } from "./db.js";
import { initFlow } from "./flow.js";
import { canSeal, initSecrets } from "./channels/secrets.js";
import { authRoutes } from "./routes/auth.js";
import { appRoutes } from "./routes/app.js";
import { publicRoutes } from "./routes/public.js";
import { startCampaignRunner } from "./voice/calls.js";
import { startDemoSimulator } from "./demo.js";
import { startPlanExpiry } from "./billing/pay.js";

const cfg = loadConfig();
const VERSION = process.env.REVISION ?? "dev";

await migrate(cfg.DATABASE_URL);
initDb(cfg.DATABASE_URL);
await initSecrets(cfg.CHANNEL_KEY);
initFlow(cfg);

const app = Fastify({ logger: { level: "warn" }, trustProxy: true, bodyLimit: 2 * 1024 * 1024 });
await app.register(cookie);
await app.register(rateLimit, { max: 600, timeWindow: "1 minute" });

app.setErrorHandler((e: Error & { statusCode?: number }, _req, reply) => {
  if (e instanceof ZodError) return reply.code(400).send({ error: e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") });
  const code = e.statusCode ?? 500;
  if (code >= 500) console.error("[api]", e);
  return reply.code(code).send({ error: code >= 500 ? "Server xatosi" : e.message });
});

authRoutes(app, cfg);
appRoutes(app, cfg);
publicRoutes(app, cfg, VERSION);

startCampaignRunner();
startPlanExpiry();
if (cfg.DEMO) startDemoSimulator();

await app.listen({ host: cfg.HOST, port: cfg.PORT });
console.log(`operobot2 api ${VERSION} :${cfg.PORT} demo=${cfg.DEMO} llm=${cfg.LLM_URL ? "on" : "qoida"} dialer=${cfg.DIALER_URL ? "on" : "sim"} payme=${cfg.PAYME_MERCHANT_ID ? "on" : "off"} kanal_shifr=${canSeal() ? "on" : "off"}`);
