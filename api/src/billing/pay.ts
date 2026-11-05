// Checkout and payment providers (docs/08-tarif.md). Demo orgs: invoice is paid at once. Real orgs: Payme / Click
// checkout URL; Payme confirms through its Merchant API (POST /api/pay/payme, JSON-RPC), then the plan switches.
// Click confirms through its SHOP API (POST /api/pay/click). Amounts: invoices and Click in so'm, Payme in tiyin (x100).
// Neither has run against a provider's real test environment yet (docs/10 §Ochiq).
import { createHash, timingSafeEqual } from "node:crypto";
import type { Config } from "../config.js";
import { SYSTEM, tx, type Q } from "../db.js";
import type { Plan } from "./plans.js";

const err = (code: number, m: string) => Object.assign(new Error(m), { statusCode: code });

async function activate(q: Q, invoiceId: string): Promise<void> {
  const inv = await q.one<{ org_id: string; plan: string; months: number }>("update invoices set status = 'paid', paid_at = now() where id = $1 returning org_id, plan, months", [invoiceId]);
  const org = await q.one<{ plan: string; plan_until: string | null }>("select plan, plan_until from orgs where id = $1 for update", [inv.org_id]);
  await q.exec("update invoices set prev_plan = $2, prev_plan_until = $3 where id = $1", [invoiceId, org.plan, org.plan_until]);
  // Time left on the same plan is kept. A different plan starts now: otherwise a cheap year bought a dear plan for a year.
  await q.exec(`update orgs set plan = $2, plan_until = (case when plan = $2 then greatest(coalesce(plan_until, now()), now()) else now() end) + ($3 || ' months')::interval where id = $1`, [inv.org_id, inv.plan, String(inv.months)]);
}

/** A paid invoice was refunded: take back what it gave. A later purchase stays, only this invoice's months go. */
async function refund(q: Q, invoiceId: string): Promise<void> {
  const inv = await q.one<{ org_id: string; plan: string; months: number; prev_plan: string | null; prev_plan_until: string | null; paid_at: string }>(
    "select org_id, plan, months, prev_plan, prev_plan_until, paid_at from invoices where id = $1", [invoiceId]);
  const later = await q.maybe("select 1 from invoices where org_id = $1 and status = 'paid' and id <> $2 and paid_at > $3 limit 1", [inv.org_id, invoiceId, inv.paid_at]);
  if (!later) await q.exec("update orgs set plan = $2, plan_until = $3 where id = $1", [inv.org_id, inv.prev_plan ?? "start", inv.prev_plan_until]);
  else await q.exec("update orgs set plan_until = plan_until - ($3 || ' months')::interval where id = $1 and plan = $2", [inv.org_id, inv.plan, String(inv.months)]);
}

/** Hourly: a paid period that ended falls back to the free plan. Demo sandboxes are deleted on their own schedule. */
export function startPlanExpiry(): void {
  const run = () => tx(SYSTEM, (q) => q.exec("update orgs set plan = 'start', plan_until = null where plan_until < now() and not demo"))
    .then((n) => { if (n) console.log(`[tarif] muddati tugadi: ${n} ta tashkilot`); })
    .catch((e) => console.warn("[tarif]", (e as Error).message));
  void run();
  setInterval(() => void run(), 3600_000).unref();
}

export async function checkout(cfg: Config, orgId: string, demo: boolean, p: Plan, months: number, amount: number, provider: "payme" | "click") {
  const real = !demo && amount > 0;
  if (real && provider === "payme" && !cfg.PAYME_MERCHANT_ID) throw err(409, "Payme ulanmagan");
  if (real && provider === "click" && (!cfg.CLICK_SERVICE_ID || !cfg.CLICK_MERCHANT_ID || !cfg.CLICK_SECRET_KEY)) throw err(409, "Click ulanmagan");
  const inv = await tx(orgId, (q) => q.one<{ id: string }>("insert into invoices(org_id, plan, months, amount, provider) values ($1,$2,$3,$4,$5) returning id", [orgId, p.key, months, Math.round(amount), provider]));
  if (!real) {
    await tx(SYSTEM, (q) => activate(q, inv.id));
    return { invoice: { id: inv.id, status: "paid" }, payUrl: null };
  }
  const back = encodeURIComponent(`${cfg.PUBLIC_URL.replace(/\/$/, "")}/#/app/billing`);
  if (provider === "payme") {
    const params = Buffer.from(`m=${cfg.PAYME_MERCHANT_ID};ac.invoice_id=${inv.id};a=${Math.round(amount) * 100};c=${decodeURIComponent(back)}`).toString("base64");
    return { invoice: { id: inv.id, status: "pending" }, payUrl: `https://checkout.paycom.uz/${params}` };
  }
  return { invoice: { id: inv.id, status: "pending" }, payUrl: `https://my.click.uz/services/pay?service_id=${cfg.CLICK_SERVICE_ID}&merchant_id=${cfg.CLICK_MERCHANT_ID}&amount=${Math.round(amount)}&transaction_param=${inv.id}&return_url=${back}` };
}

// ---- Payme Merchant API (https://developer.help.paycom.uz) -------------------------------------------------
type Rpc = { id?: number | string; method?: string; params?: Record<string, any> };
const E = (code: number, message: string, data?: string) => ({ error: { code, message: { uz: message, ru: message, en: message }, data } });
const TIMEOUT = 12 * 3600_000;

export function paymeAuthOk(cfg: Config, header: string | undefined): boolean {
  if (!cfg.PAYME_KEY || !header?.startsWith("Basic ")) return false;
  const want = Buffer.from(`Paycom:${cfg.PAYME_KEY}`);
  const got = Buffer.from(Buffer.from(header.slice(6), "base64").toString());
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function payme(rpc: Rpc): Promise<Record<string, unknown>> {
  const p = rpc.params ?? {};
  const res = await tx(SYSTEM, async (q): Promise<Record<string, unknown>> => {
    const invoice = async () => {
      const id = String(p.account?.invoice_id ?? "");
      if (!/^[0-9a-f-]{36}$/.test(id)) return undefined;
      return q.maybe<{ id: string; org_id: string; amount: number; status: string }>("select id, org_id, amount, status from invoices where id = $1 and provider = 'payme'", [id]);
    };
    const txOut = (t: { id: string; create_time: number; perform_time: number; cancel_time: number; state: number; reason: number | null }) =>
      ({ create_time: +t.create_time, perform_time: +t.perform_time, cancel_time: +t.cancel_time, transaction: t.id, state: t.state, reason: t.reason });
    switch (rpc.method) {
      case "CheckPerformTransaction": {
        const inv = await invoice();
        if (!inv || inv.status !== "pending") return E(-31050, "Hisob topilmadi", "invoice_id");
        if (Number(p.amount) !== inv.amount * 100) return E(-31001, "Summa noto'g'ri");
        return { result: { allow: true } };
      }
      case "CreateTransaction": {
        const ex = await q.maybe<any>("select * from payme_tx where id = $1", [String(p.id)]);
        if (ex) {
          if (ex.state !== 1) return E(-31008, "Tranzaksiya holati noto'g'ri");
          if (Date.now() - Number(ex.create_time) > TIMEOUT) {
            await q.exec("update payme_tx set state = -1, reason = 4, cancel_time = $2 where id = $1", [ex.id, Date.now()]);
            return E(-31008, "Tranzaksiya muddati o'tdi");
          }
          return { result: { create_time: +ex.create_time, transaction: ex.id, state: ex.state } };
        }
        const inv = await invoice();
        if (!inv || inv.status !== "pending") return E(-31050, "Hisob topilmadi", "invoice_id");
        if (Number(p.amount) !== inv.amount * 100) return E(-31001, "Summa noto'g'ri");
        if (await q.maybe("select 1 from payme_tx where invoice_id = $1 and state = 1", [inv.id])) return E(-31050, "Hisob boshqa tranzaksiyada band", "invoice_id");
        const now = Date.now();
        await q.exec("insert into payme_tx(id, invoice_id, org_id, amount, state, payme_time, create_time) values ($1,$2,$3,$4,1,$5,$6)", [String(p.id), inv.id, inv.org_id, Number(p.amount), Number(p.time), now]);
        return { result: { create_time: now, transaction: String(p.id), state: 1 } };
      }
      case "PerformTransaction": {
        const t = await q.maybe<any>("select * from payme_tx where id = $1", [String(p.id)]);
        if (!t) return E(-31003, "Tranzaksiya topilmadi");
        if (t.state === 2) return { result: { transaction: t.id, perform_time: +t.perform_time, state: 2 } };
        if (t.state !== 1) return E(-31008, "Tranzaksiya holati noto'g'ri");
        if (Date.now() - Number(t.create_time) > TIMEOUT) {
          await q.exec("update payme_tx set state = -1, reason = 4, cancel_time = $2 where id = $1", [t.id, Date.now()]);
          return E(-31008, "Tranzaksiya muddati o'tdi");
        }
        const now = Date.now();
        await q.exec("update payme_tx set state = 2, perform_time = $2 where id = $1", [t.id, now]);
        await activate(q, t.invoice_id);
        return { result: { transaction: t.id, perform_time: now, state: 2 } };
      }
      case "CancelTransaction": {
        const t = await q.maybe<any>("select * from payme_tx where id = $1", [String(p.id)]);
        if (!t) return E(-31003, "Tranzaksiya topilmadi");
        if (t.state < 0) return { result: { transaction: t.id, cancel_time: +t.cancel_time, state: t.state } };
        const now = Date.now();
        const state = t.state === 2 ? -2 : -1;
        if (t.state === 2) await refund(q, t.invoice_id);
        await q.exec("update payme_tx set state = $2, reason = $3, cancel_time = $4 where id = $1", [t.id, state, Number(p.reason ?? 0), now]);
        await q.exec("update invoices set status = 'failed' where id = $1", [t.invoice_id]);
        return { result: { transaction: t.id, cancel_time: now, state } };
      }
      case "CheckTransaction": {
        const t = await q.maybe<any>("select * from payme_tx where id = $1", [String(p.id)]);
        return t ? { result: txOut(t) } : E(-31003, "Tranzaksiya topilmadi");
      }
      case "GetStatement": {
        const rows = await q.many<any>("select * from payme_tx where payme_time between $1 and $2 order by payme_time", [Number(p.from), Number(p.to)]);
        return { result: { transactions: rows.map((t) => ({ id: t.id, time: +t.payme_time, amount: +t.amount, account: { invoice_id: t.invoice_id }, ...txOut(t), transaction: t.id })) } };
      }
      default:
        return E(-32601, "Metod topilmadi");
    }
  });
  return { jsonrpc: "2.0", id: rpc.id ?? null, ...res };
}

// ---- Click SHOP API (https://docs.click.uz/shop-api). Fields and codes follow click-llc/click-integration-php.
type ClickBody = Record<string, string | undefined>;
const CLICK_ERRORS: Record<number, string> = {
  0: "Success", [-1]: "SIGN CHECK FAILED!", [-2]: "Incorrect parameter amount", [-3]: "Action not found", [-4]: "Already paid",
  [-5]: "User does not exist", [-6]: "Transaction does not exist", [-8]: "Error in request from click", [-9]: "Transaction cancelled",
};

export function clickSignOk(cfg: Config, b: ClickBody): boolean {
  if (!cfg.CLICK_SECRET_KEY) return false;
  const want = createHash("md5").update(
    String(b.click_trans_id) + String(b.service_id) + cfg.CLICK_SECRET_KEY + String(b.merchant_trans_id) +
    (b.action === "1" ? String(b.merchant_prepare_id) : "") + String(b.amount) + String(b.action) + String(b.sign_time)).digest("hex");
  const got = Buffer.from(String(b.sign_string).toLowerCase());
  return got.length === want.length && timingSafeEqual(got, Buffer.from(want));
}

/** Handles Prepare (action=0) and Complete (action=1). Always answers 200: Click reads the error field. */
export async function click(cfg: Config, b: ClickBody): Promise<Record<string, unknown>> {
  const out = (error: number, ids: { prepare?: number; confirm?: number } = {}) => ({
    click_trans_id: b.click_trans_id ?? null, merchant_trans_id: b.merchant_trans_id ?? null,
    ...(ids.prepare !== undefined ? { merchant_prepare_id: ids.prepare } : {}),
    ...(ids.confirm !== undefined ? { merchant_confirm_id: ids.confirm } : {}),
    error, error_note: CLICK_ERRORS[error],
  });
  const missing = ["click_trans_id", "service_id", "merchant_trans_id", "amount", "action", "error", "sign_time", "sign_string"].some((k) => !b[k]?.toString().length)
    || (b.action === "1" && !b.merchant_prepare_id) || !/^\d+$/.test(String(b.click_trans_id));
  if (missing) return out(-8);
  if (!clickSignOk(cfg, b)) return out(-1);
  if (b.service_id !== cfg.CLICK_SERVICE_ID) return out(-8);
  if (b.action !== "0" && b.action !== "1") return out(-3);
  if (!/^[0-9a-f-]{36}$/.test(String(b.merchant_trans_id))) return out(-5);
  return tx(SYSTEM, async (q) => {
    const inv = await q.maybe<{ id: string; org_id: string; amount: number; status: string }>(
      "select id, org_id, amount, status from invoices where id = $1 and provider = 'click' for update", [b.merchant_trans_id]);
    if (!inv) return out(-5);
    if (inv.status === "paid") return out(-4);
    if (inv.status === "failed") return out(-9);
    if (Math.abs(Number(b.amount) - Number(inv.amount)) >= 0.01) return out(-2);
    if (b.action === "0") {
      const t = await q.one<{ id: number; state: number }>(
        "insert into click_tx(click_trans_id, invoice_id, org_id, amount) values ($1,$2,$3,$4) on conflict (click_trans_id) do update set click_trans_id = excluded.click_trans_id returning id, state",
        [b.click_trans_id, inv.id, inv.org_id, inv.amount]);
      return t.state === -1 ? out(-9) : out(0, { prepare: Number(t.id) });
    }
    if (!/^\d+$/.test(String(b.merchant_prepare_id))) return out(-6);
    const t = await q.maybe<{ id: number; state: number }>("select id, state from click_tx where id = $1 and click_trans_id = $2 and invoice_id = $3 for update", [b.merchant_prepare_id, b.click_trans_id, inv.id]);
    if (!t) return out(-6);
    if (t.state === -1) return out(-9);
    if (Number(b.error) < 0) { // Click reports that the payment failed on its side
      await q.exec("update click_tx set state = -1 where id = $1", [t.id]);
      await q.exec("update invoices set status = 'failed' where id = $1", [inv.id]);
      return out(-9);
    }
    await q.exec("update click_tx set state = 1, completed_at = now() where id = $1", [t.id]);
    await activate(q, inv.id);
    return out(0, { confirm: Number(t.id) });
  });
}
