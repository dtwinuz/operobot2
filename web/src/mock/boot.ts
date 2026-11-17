// Static demo entry: in-memory /api, fake EventSource, demo pill. Loaded only by vite --mode demo.
import { DemoEventSource, installFetch } from './server'

const PILL: Record<string, string> = {
  uz: "Demo · namuna ma'lumotlar, qayta yuklanganda tiklanadi",
  ru: 'Демо · примерные данные, сбрасываются при перезагрузке',
  en: 'Demo · sample data, changes reset on reload',
}

export function boot(): void {
  installFetch()
  ;(window as unknown as { EventSource: unknown }).EventSource = DemoEventSource
  if (!location.hash || location.hash === '#' || location.hash === '#/') location.replace('#/app')
  const pill = document.createElement('div')
  pill.className = 'o2-demo-pill'
  pill.setAttribute('role', 'note')
  pill.textContent = PILL[document.documentElement.lang] ?? PILL.uz!
  const css = document.createElement('style')
  css.textContent = `.o2-demo-pill{position:fixed;right:16px;bottom:16px;z-index:90;padding:7px 12px;border-radius:999px;font:500 12px/1.3 Inter,system-ui,sans-serif;color:#fff;background:rgb(15 23 42 / .88);border:1px solid rgb(255 255 255 / .14);box-shadow:0 6px 24px rgb(0 0 0 / .25);backdrop-filter:blur(8px);pointer-events:none;max-width:calc(100vw - 32px)}
.o2-toasts{bottom:56px!important}
body:has(.o2-inbox) .o2-demo-pill{max-width:250px;border-radius:14px}
@media (max-width:640px){.o2-demo-pill{font-size:11px;right:8px;bottom:8px;max-width:calc(100vw - 16px)}}`
  document.head.append(css)
  document.body.append(pill)
}
