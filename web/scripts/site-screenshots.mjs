// Builds nothing itself: run via `npm run site:screenshots` (build:demo first).
// Opens the static demo and writes 1440x900 JPEG screenshots (+ one phone shot) to ../docs/screenshots/.
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { BASE, serve } from './serve-demo.mjs'

const OUT = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url))
const PORT = 47313
const URL0 = `http://127.0.0.1:${PORT}${BASE}`

const srv = await serve(PORT)
await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()

async function ctx(opts = {}) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light', ...opts })
  await c.addInitScript(({ theme, lang }) => {
    try { localStorage.setItem('o2-theme', theme); localStorage.setItem('o2-lang', lang) } catch { /* ignore */ }
  }, { theme: opts.theme ?? 'light', lang: opts.lang ?? 'uz' })
  return c
}
const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 78 })
const settle = page => page.waitForTimeout(700)

async function open(page, hash) {
  await page.goto(`${URL0}#${hash}`)
  await page.waitForSelector('.o2-page, .o2-land, .o2-auth', { timeout: 15_000 })
  await page.waitForFunction(() => !document.querySelector('.o2-page .o2-skel, .o2-page .o2-skeleton'), null, { timeout: 8_000 }).catch(() => {})
  await settle(page)
}

const c1 = await ctx()
const p = await c1.newPage()
p.on('pageerror', e => console.error('pageerror', e.message))

await open(p, '/app'); await shot(p, '01-dashboard')

await open(p, '/app/inbox')
await p.locator('.o2-conv').nth(1).click(); await settle(p)
await p.locator('.o2-composer textarea, .o2-composer input').first().fill('Ertaga soat 11:00 da ustamiz manzilga boradi, mos keladimi?')
await shot(p, '02-inbox')

await open(p, '/app/board'); await shot(p, '03-board')

await open(p, '/app/contacts'); await shot(p, '04-contacts')
await p.locator('tr.click').nth(2).click(); await p.waitForTimeout(1200); await shot(p, '05-contact-card')

await open(p, '/app/calls')
await p.locator('.o2-camp').first().click(); await p.waitForTimeout(4500); await shot(p, '06-calls')
await p.locator('.o2-page-h .o2-btn.primary').click(); await settle(p)
await p.locator('.o2-inline-form input').first().fill('Dekabr: yangi mijozlar')
await p.locator('.o2-inline-form textarea').fill('+998 00 120 45 67\n+998 00 233 18 90\n+998 00 341 77 02\n+998 00 455 60 13\n+998 00 562 09 48')
await p.locator('.o2-inline-form input[type=checkbox]').check()
await shot(p, '07-campaign-new')

await open(p, '/app/agents')
const inp = p.locator('.o2-test .o2-composer input')
for (const m of ['Assalomu alaykum, konditsioner o‘rnatish narxi qancha?', 'Ertaga soat 15:00 da kela olasizmi? Raqamim +998 00 412 55 18']) {
  await inp.fill(m); await inp.press('Enter'); await p.waitForTimeout(900)
}
await p.locator('.o2-test .o2-msgs').evaluate(el => { el.scrollTop = el.scrollHeight })
await shot(p, '08-agents')

await open(p, '/app/channels')
await p.locator('.o2-chcard.telegram .o2-btn').first().click(); await settle(p)
await shot(p, '09-channels')

await open(p, '/app/team'); await shot(p, '10-team')
await open(p, '/app/billing'); await shot(p, '11-billing')
await open(p, '/app/settings'); await shot(p, '12-settings')
await open(p, '/landing'); await p.waitForTimeout(6000); await shot(p, '13-landing')
await open(p, '/login'); await shot(p, '14-login')
await c1.close()

const c2 = await ctx({ theme: 'dark' })
const d = await c2.newPage()
await open(d, '/app/inbox'); await d.locator('.o2-conv').first().click(); await settle(d); await shot(d, '15-inbox-dark')
await c2.close()

const c3 = await ctx({ theme: 'dark', lang: 'en' })
const e = await c3.newPage()
await open(e, '/app'); await shot(e, '16-dashboard-en')
await c3.close()

const c4 = await ctx({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const m = await c4.newPage()
await open(m, '/app/inbox')
await m.screenshot({ path: `${OUT}17-phone.jpg`, type: 'jpeg', quality: 78 })
await c4.close()

await browser.close()
srv.close()
console.log(`screenshots -> ${OUT}`)
