import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { AtSign, Camera, Globe, MessageCircle, MessageSquareText, Phone, Send, UserPen } from 'lucide-react'
import { t } from './i18n'

/* ---------- hash router ---------- */
export function useHash(): string {
  const [h, setH] = useState(() => location.hash.slice(1) || '/')
  useEffect(() => {
    const on = () => setH(location.hash.slice(1) || '/')
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return h
}
export const go = (path: string) => { location.hash = path }

/* ---------- theme ---------- */
export function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      try { localStorage.setItem('o2-theme', next) } catch { /* storage blocked */ }
      return next
    })
  }, [])
  return [theme, toggle]
}

/* ---------- toasts ---------- */
type Toast = { id: number; text: string; tone: 'ok' | 'err' | 'info' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastHost({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random()
    setList(l => [...l.slice(-3), { id, text, tone }])
    setTimeout(() => setList(l => l.filter(x => x.id !== id)), 3800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="o2-toasts" role="status" aria-live="polite">
        {list.map(x => <div key={x.id} className={`o2-toast ${x.tone}`}>{x.text}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- formatting ---------- */
export const money = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ')} ${t.common.som}`)
export const num = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ')
const pad = (n: number) => String(n).padStart(2, '0')
export function hm(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export function when(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return hm(iso)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${hm(iso)}`
}
export function ago(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'hozir'
  if (s < 3600) return `${Math.floor(s / 60)} daq`
  if (s < 86400) return `${Math.floor(s / 3600)} soat`
  return `${Math.floor(s / 86400)} kun`
}
export const dur = (sec: number) => `${Math.floor(sec / 60)}:${pad(Math.floor(sec % 60))}`
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]!.toUpperCase()).join('') || '?'
export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/* ---------- channel icon ---------- */
export function ChIcon({ kind, size = 14 }: { kind: string; size?: number }) {
  const p = { size, 'aria-hidden': true }
  switch (kind) {
    case 'telegram': return <Send {...p} />
    case 'whatsapp': return <MessageCircle {...p} />
    case 'instagram': return <Camera {...p} />
    case 'sms': return <MessageSquareText {...p} />
    case 'widget': return <Globe {...p} />
    case 'call': return <Phone {...p} />
    case 'manual': return <UserPen {...p} />
    default: return <AtSign {...p} />
  }
}
export function ChBadge({ kind }: { kind: string }) {
  return <span className={`o2-ch ${kind}`} title={t.channels[kind] ?? kind}><ChIcon kind={kind} size={12} /></span>
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return <span className="o2-av" style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${h} 55% 52%)` }}>{initials(name)}</span>
}

/* ---------- async loader ---------- */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => {
    setLoading(true)
    fn().then(d => { setData(d); setError(null) }).catch(e => setError(errText(e))).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { reload() }, [reload])
  return { data, setData, error, loading, reload }
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return <div className="o2-skel">{Array.from({ length: rows }, (_, i) => <span key={i} style={{ width: `${92 - (i % 3) * 18}%` }} />)}</div>
}
export function ErrorBox({ text, retry }: { text: string; retry?: () => void }) {
  return <div className="o2-errbox"><b>{t.common.error}:</b> {text}{retry && <button className="o2-btn sm" onClick={retry}>{t.common.retry}</button>}</div>
}
export function Empty({ text = t.common.empty, icon }: { text?: string; icon?: ReactNode }) {
  return <div className="o2-empty">{icon}<span>{text}</span></div>
}

export async function copy(text: string, toast: (s: string, tone?: 'ok') => void) {
  try { await navigator.clipboard.writeText(text); toast(t.common.copied, 'ok') } catch { /* clipboard blocked */ }
}
