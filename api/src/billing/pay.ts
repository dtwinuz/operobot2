// Checkout and payment providers (docs/08-tarif.md). Demo orgs: invoice is paid at once. Real orgs: Payme / Click
// checkout URL; Payme confirms through its Merchant API (POST /api/pay/payme, JSON-RPC), then the plan switches.
// Amounts: invoices in so'm, Payme in tiyin (x100). Not yet run against the Payme sandbox (docs/10 §Ochiq).
import { timingSafeEqual } from "node:crypto";
import type { Config } from "../config.js";
import { SYSTEM, tx, type Q } from "../db.js";
import type { Plan } from "./plans.js";

const err = (code: number, m: string) => Object.assign(new Error(m), { statusCode: code });

async function activate(q: Q, invoiceId: string): Promise<void> {
  const inv = await q.one<{ org_id: string; plan: string; months: number }>("update invoices set status = 'paid', paid_at = now() where id = $1 returning org_id, plan, months", [invoiceId]);
  await q.exec("update orgs set plan = $2, plan_until = greatest(coalesce(plan_until, now()), now()) + ($3 || ' months')::interval where id = $1", [inv.org_id, inv.plan, String(inv.months)]);
}

export async function checkout(cfg: Config, orgId: string, demo: boolean, p: Plan, months: number, amount: number, provider: "payme" | "click") {
  const real = !demo && amount > 0;
  if (real && provider === "payme" && !cfg.PAYME_MERCHANT_ID) throw err(409, "Payme ulanmagan");
  if (real && provider === "click" && (!cfg.CLICK_SERVICE_ID || !cfg.CLICK_MERCHANT_ID)) throw err(409, "Click ulanmagan");
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
