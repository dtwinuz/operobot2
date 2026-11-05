import { useEffect, useState } from 'react'
import { Search, Users, X } from 'lucide-react'
import { get, patch } from '../api/client'
import type { Contact, ContactDetail } from '../api/types'
import { t } from '../i18n'
import { ago, Avatar, ChBadge, dur, Empty, ErrorBox, errText, money, Skeleton, useLoad, when } from '../lib'

const C = t.contacts

export function ContactsPage() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const { data, error, loading, reload } = useLoad(() => get<Contact[]>(`/contacts?q=${encodeURIComponent(q.trim())}`), [q])
  return (
    <>
      <div className="o2-page-h">
        <h1 className="o2-h1">{C.title}</h1><span className="o2-mono">{data?.length ?? ''}</span><span className="o2-flex" />
        <label className="o2-search"><Search size={14} /><input value={q} placeholder={t.common.search} onChange={e => setQ(e.target.value)} /></label>
      </div>
      <div className="o2-card flush">
        {error ? <ErrorBox text={error} retry={reload} /> : loading && !data ? <Skeleton rows={8} /> : !data?.length ? <Empty icon={<Users size={22} />} /> : (
          <div className="o2-table-wrap">
            <table className="o2-table">
              <thead><tr><th>{t.common.name}</th><th>{t.common.phone}</th><th>{C.channel}</th><th className="hide-sm">{C.tags}</th><th>{C.leads}</th><th className="hide-sm">{C.lastSeen}</th></tr></thead>
              <tbody>
                {data.map(c => (
                  <tr key={c.id} className="click" onClick={() => setOpen(c.id)}>
                    <td><span className="o2-cell-name"><Avatar name={c.name} size={26} /><b>{c.name}</b>{c.username && <small>@{c.username}</small>}</span></td>
                    <td className="o2-mono">{c.phone ?? '—'}</td>
                    <td><ChBadge kind={c.channel} /> <span className="hide-sm">{t.channels[c.channel]}</span></td>
                    <td className="hide-sm">{c.tags.map(x => <span key={x} className="o2-tag mute">{x}</span>)}</td>
                    <td className="o2-mono">{c.leads}</td>
                    <td className="hide-sm">{ago(c.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && <Drawer id={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function Drawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<ContactDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  async function toggleDnc() {
    if (!d) return
    setSaving(true)
    try { const r = await patch<{ doNotCallAt: string | null }>(`/contacts/${id}`, { doNotCall: !d.doNotCallAt }); setD({ ...d, doNotCallAt: r.doNotCallAt }); setErr(null) }
    catch (e) { setErr(errText(e)) } finally { setSaving(false) }
  }
  useEffect(() => {
    let dead = false
    setD(null)
    get<ContactDetail>(`/contacts/${id}`).then(x => !dead && setD(x)).catch(e => !dead && setErr(errText(e)))
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', esc)
    return () => { dead = true; removeEventListener('keydown', esc) }
  }, [id, onClose])
  return (
    <>
      <div className="o2-scrim" onClick={onClose} />
      <aside className="o2-drawer" role="dialog" aria-modal="true">
        <button className="o2-icon-btn o2-drawer-x" onClick={onClose} aria-label={t.common.close}><X size={18} /></button>
        {err && !d ? <ErrorBox text={err} /> : !d ? <Skeleton rows={8} /> : (
          <>
            <div className="o2-drawer-h"><Avatar name={d.name} size={48} /><div><h2>{d.name}</h2><small className="o2-mono">{d.phone ?? '—'}{d.username ? ` · @${d.username}` : ''}</small></div></div>
            <div className="o2-kv">
              <span>{C.channel}</span><b><ChBadge kind={d.channel} /> {t.channels[d.channel]}</b>
              <span>{C.created}</span><b>{when(d.createdAt)}</b>
              <span>{C.lastSeen}</span><b>{ago(d.lastSeenAt)}</b>
              {d.phone && <><span>{C.doNotCall}</span><b>{d.doNotCallAt ? C.doNotCallOn : C.doNotCallOff}</b></>}
            </div>
            {err && <ErrorBox text={err} />}
            {d.phone && <button className="o2-btn sm ghost" disabled={saving} onClick={() => void toggleDnc()}>{d.doNotCallAt ? C.unblock : C.block}</button>}
            <h3>{C.leads}</h3>
            {d.leads.length ? <ul className="o2-list">{d.leads.map(l => <li key={l.id}><b>{l.title}</b><span>{money(l.value)}</span></li>)}</ul> : <p className="o2-muted">{t.common.empty}</p>}
            <h3>{C.conversations}</h3>
            {d.conversations.length ? <ul className="o2-list">{d.conversations.map(c => <li key={c.id}><a href={`#/app/inbox/${c.id}`}><ChBadge kind={c.channel} /> {c.last?.text ?? '—'}</a><span>{ago(c.last?.at)}</span></li>)}</ul> : <p className="o2-muted">{t.common.empty}</p>}
            <h3>{C.calls}</h3>
            {d.calls.length ? <ul className="o2-list">{d.calls.map(c => <li key={c.id}><span className={`o2-tag cs-${c.status}`}>{t.callStatus[c.status]}</span><span>{when(c.startedAt)} · {dur(c.durationSec)}</span></li>)}</ul> : <p className="o2-muted">{t.common.empty}</p>}
          </>
        )}
      </aside>
    </>
  )
}
