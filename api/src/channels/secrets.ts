// Channel credentials at rest (docs/07). AES-256-GCM inside the API process, so PostgreSQL, its logs and its dumps only
// hold ciphertext; the key (CHANNEL_KEY) lives in .env. The org id is authenticated data: a blob copied into another
// tenant's row will not open.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { SYSTEM, tx } from "../db.js";

type Sealed = { enc: 1; iv: string; tag: string; data: string };
type Plain = Record<string, string>;

let key: Buffer | null = null;

export const canSeal = () => key !== null;
export const hasCredentials = (config: Plain) => Object.values(config).some((v) => v?.trim());

const isSealed = (c: unknown): c is Sealed => (c as Sealed | null)?.enc === 1;

/** Value for channels.config. A config with nothing in it stays {} (a demo channel has no secrets to protect). */
export function seal(orgId: string, config: Plain): Sealed | Record<string, never> {
  if (!hasCredentials(config)) return {};
  if (!key) throw new Error("CHANNEL_KEY sozlanmagan");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(orgId));
  const data = Buffer.concat([c.update(JSON.stringify(config), "utf8"), c.final()]);
  return { enc: 1, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") };
}

function unseal(orgId: string, s: Sealed): Plain {
  if (!key) throw new Error("CHANNEL_KEY sozlanmagan");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(s.iv, "base64"));
  d.setAAD(Buffer.from(orgId));
  d.setAuthTag(Buffer.from(s.tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(s.data, "base64")), d.final()]).toString("utf8")) as Plain;
}

/** The row with its credentials readable. Rows saved before encryption pass through until startup seals them. */
export function openChannel<T extends { org_id: string; config: unknown }>(row: T): Omit<T, "config"> & { config: Plain } {
  return { ...row, config: isSealed(row.config) ? unseal(row.org_id, row.config) : (row.config as Plain) };
}

/**
 * Startup: load the key, seal rows still in plain text and prove every sealed row opens. A wrong or missing key stops
 * the API here, with one clear error, instead of failing later on each webhook.
 */
export async function initSecrets(hexKey: string): Promise<void> {
  key = hexKey ? Buffer.from(hexKey, "hex") : null;
  await tx(SYSTEM, async (q) => {
    const rows = await q.many<{ id: string; org_id: string; config: unknown }>("select id, org_id, config from channels where config <> '{}'::jsonb");
    let plain = 0;
    for (const r of rows) {
      if (isSealed(r.config)) {
        try { unseal(r.org_id, r.config); } catch { throw new Error(`CHANNEL_KEY bu kanalni ocholmadi: ${r.id}`); }
      } else if (key) {
        await q.exec("update channels set config = $2 where id = $1", [r.id, seal(r.org_id, r.config as Plain)]);
        console.log(`[kanal] shifrlandi: ${r.id}`);
      } else {
        plain++;
      }
    }
    if (plain) console.warn(`[kanal] ${plain} ta kanal kaliti shifrlanmagan: CHANNEL_KEY ni sozlang`);
  });
}
