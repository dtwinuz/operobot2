import { expect, test, type Page } from '@playwright/test'

// Smoke test of the static demo (npm run test:demo): every page renders filled with sample data, no console errors.
const ROUTES: [string, string][] = [
  ['/app', '.o2-page'],
  ['/app/inbox', '.o2-conv'],
  ['/app/board', '.o2-page'],
  ['/app/contacts', 'tr.click'],
  ['/app/calls', '.o2-camp'],
  ['/app/agents', '.o2-agent-i'],
  ['/app/channels', '.o2-chcard'],
  ['/app/team', '.o2-page table'],
  ['/app/billing', '.o2-page'],
  ['/app/settings', '.o2-page input'],
  ['/landing', '.o2-land'],
  ['/login', '.o2-auth'],
  ['/signup', '.o2-auth'],
]

function watch(page: Page) {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => {
    // external web fonts may be unreachable in CI; everything else must be clean
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(m.text() + (m.location().url ?? ''))) errors.push(m.text())
  })
  return errors
}

for (const [hash, sel] of ROUTES) {
  test(`renders #${hash}`, async ({ page }) => {
    const errors = watch(page)
    await page.goto(`./#${hash}`)
    await expect(page.locator(sel).first()).toBeVisible()
    await expect(page.locator('.o2-demo-pill')).toBeVisible()
    await expect(page.locator('.o2-skel')).toHaveCount(0, { timeout: 8_000 })
    expect(errors).toEqual([])
  })
}

test('lists are dense', async ({ page }) => {
  const atLeast = async (hash: string, sel: string, n: number) => {
    await page.goto(`./#${hash}`)
    await expect(page.locator(sel).nth(n - 1)).toBeAttached()
  }
  await atLeast('/app/inbox', '.o2-conv', 15)
  await atLeast('/app/board', '.o2-lead', 30)
  await atLeast('/app/contacts', 'tr.click', 30)
  await atLeast('/app/calls', '.o2-page tbody tr', 30)
})

test('inbox: operator reply lands in the thread', async ({ page }) => {
  await page.goto('./#/app/inbox')
  await page.locator('.o2-conv').first().click()
  await expect(page.locator('.o2-msg').first()).toBeVisible({ timeout: 10_000 })
  const box = page.locator('.o2-composer textarea, .o2-composer input').first()
  await box.fill('Salom, demo javob')
  await page.locator('.o2-composer button.primary').click()
  await expect(page.locator('.o2-msg', { hasText: 'Salom, demo javob' }).first()).toBeVisible({ timeout: 10_000 })
})

test('board: new lead is added in memory', async ({ page }) => {
  await page.goto('./#/app/board')
  await expect(page.locator('.o2-lead').nth(20)).toBeAttached()
  const before = await page.locator('.o2-lead').count()
  await page.locator('.o2-page-h .o2-btn.primary').click()
  const form = page.locator('form.o2-inline-form, form.o2-card').first()
  const inputs = form.locator('input:not([type=checkbox])')
  await inputs.nth(0).fill('Demo lid: 3 xona remont')
  await inputs.nth(1).fill('Demo Mijoz')
  await form.locator('button.primary').click()
  await expect(page.locator('.o2-lead')).toHaveCount(before + 1)
})

test('agents: test chat answers with the rule engine', async ({ page }) => {
  await page.goto('./#/app/agents')
  const inp = page.locator('.o2-test .o2-composer input')
  await inp.fill('Narxi qancha?')
  await inp.press('Enter')
  await expect(page.locator('.o2-test .o2-msg.ai').last()).toContainText(/Narx/)
})
