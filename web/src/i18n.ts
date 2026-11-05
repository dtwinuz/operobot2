// Picks the UI language. Strings are read once at startup, so changing language reloads the page.
import { en } from './locales/en'
import { ru } from './locales/ru'
import { uz, type Dict } from './locales/uz'

export type Lang = 'uz' | 'ru' | 'en'
export const LANGS: { key: Lang; label: string }[] = [{ key: 'uz', label: "O'zbekcha" }, { key: 'ru', label: 'Русский' }, { key: 'en', label: 'English' }]
const KEY = 'o2-lang'
const DICTS: Record<Lang, Dict> = { uz, ru, en }

function stored(): Lang {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'uz' || v === 'ru' || v === 'en') return v
  } catch { /* blocked storage: default language */ }
  return 'uz'
}

export const lang: Lang = stored()
export const t: Dict = DICTS[lang]
document.documentElement.lang = lang
document.title = t.meta.title

export function setLang(next: Lang): void {
  try { localStorage.setItem(KEY, next) } catch { /* the page still reloads in the default language */ }
  location.reload()
}
