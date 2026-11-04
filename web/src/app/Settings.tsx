import { useEffect, useState, type FormEvent } from 'react'
import { Copy, KeyRound } from 'lucide-react'
import { get, patch, post } from '../api/client'
import type { Settings } from '../api/types'
import { t } from '../i18n'
import { copy, ErrorBox, errText, Skeleton, useToast } from '../lib'
import { useApp } from './ctx'

const S = t.settings
const HOURS = Array.from({ length: 25 }, (_, h) => h)
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

export function SettingsPage() {
  const { reloadMe, me } = useApp()
  const toast = useToast()
  const [s, setS] = useState<Settings | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [key, setKey] = useState<string | null>(null)
  const canEdit = me.role !== 'operator'
  useEffect(() => { get<Settings>('/settings').then(setS).catch(e => setErr(errText(e))) }, [])

  async function save(e: FormEvent) {
    e.preventDefault(); if (!s) return; setBusy(true)
    try { setS(await patch<Settings>('/settings', { name: s.name, timezone: s.timezone, workFrom: s.workFrom, workTo: s.workTo })); toast(t.common.saved, 'ok'); reloadMe() } catch (er) { toast(errText(er), 'err') } finally { setBusy(false) }
  }
  async function newKey() {
    try { setKey((await post<{ key: string }>('/settings/api-key')).key) } catch (er) { toast(errText(er), 'err') }
  }
  if (err) return <ErrorBox text={err} />
  if (!s) return <Skeleton rows={6} />
  const endpoint = `${location.origin}/api/mcp`
  const snippet = JSON.stringify({ mcpServers: { operobot2: { type: 'http', url: endpoint, headers: { Authorization: `Bearer ${key ?? '<API_KALIT>'}` } } } }, null, 2)
  return (
    <>
      <div className="o2-page-h"><h1 className="o2-h1">{S.title}</h1></div>
      <div className="o2-grid2 top">
        <form className="o2-card o2-form" onSubmit={save}>
          <div className="o2-card-h"><b>{S.org}</b></div>
          <label className="o2-field"><span>{t.common.name}</span><input required disabled={!canEdit} value={s.name} onChange={e => setS({ ...s, name: e.target.value })} /></label>
          <label className="o2-field"><span>{S.timezone}</span><select disabled={!canEdit} value={s.timezone} onChange={e => setS({ ...s, timezone: e.target.value })}>
            {['Asia/Tashkent', 'Asia/Samarkand', 'Asia/Almaty', 'Europe/Moscow'].map(z => <option key={z}>{z}</option>)}</select></label>
          <div className="o2-grid2">
            <label className="o2-field"><span>{S.workFrom}</span><select disabled={!canEdit} value={s.workFrom} onChange={e => setS({ ...s, workFrom: Number(e.target.value) })}>{HOURS.slice(0, 24).map(h => <option key={h} value={h}>{hh(h)}</option>)}</select></label>
            <label className="o2-field"><span>{S.workTo}</span><select disabled={!canEdit} value={s.workTo} onChange={e => setS({ ...s, workTo: Number(e.target.value) })}>{HOURS.slice(1).map(h => <option key={h} value={h}>{hh(h)}</option>)}</select></label>
          </div>
          <small className="o2-muted">{t.calls.lock}</small>
          {canEdit && <div className="o2-row end"><button className="o2-btn primary sm" disabled={busy}>{t.common.save}</button></div>}
        </form>
        <section className="o2-card o2-form">
          <div className="o2-card-h"><KeyRound size={15} /><b>{S.apiKey}</b></div>
          {!key && s.apiKeyPrefix ? <p className="o2-muted sm"><code>{s.apiKeyPrefix}_…</code></p> : null}
          {key ? <div className="o2-banner ok"><span>{S.keyOnce}</span></div> : null}
          {key && <div className="o2-copy"><code>{key}</code><button className="o2-icon-btn sm" onClick={() => void copy(key, toast)} aria-label={t.common.copy}><Copy size={13} /></button></div>}
          {canEdit && <div><button className="o2-btn sm ghost" onClick={() => void newKey()}>{S.createKey}</button></div>}
          <div className="o2-card-h"><b>{S.mcp}</b></div>
          <p className="o2-muted sm">{S.mcpHint}</p>
          <div className="o2-copy"><small>POST</small><code>{endpoint}</code><button className="o2-icon-btn sm" onClick={() => void copy(endpoint, toast)} aria-label={t.common.copy}><Copy size={13} /></button></div>
          <pre className="o2-pre">{snippet}</pre>
          <div><button className="o2-btn sm ghost" onClick={() => void copy(snippet, toast)}><Copy size={13} /> {t.common.copy}</button></div>
        </section>
      </div>
    </>
  )
}
