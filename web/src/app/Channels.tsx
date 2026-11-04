import { useState, type FormEvent } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { del, get, post } from '../api/client'
import type { Channel, ChannelKind } from '../api/types'
import { t } from '../i18n'
import { ChIcon, copy, ErrorBox, errText, Skeleton, useLoad, useToast, when } from '../lib'

const P = t.channelsP
const KINDS: ChannelKind[] = ['telegram', 'whatsapp', 'instagram', 'sms', 'widget']
const FIELDS: Record<ChannelKind, string[]> = {
  telegram: ['token'], whatsapp: ['phoneNumberId', 'token', 'verifyToken'], instagram: ['pageId', 'token'], sms: ['url', 'token', 'from'], widget: [],
}

export function ChannelsPage() {
  const toast = useToast()
  const { data, setData, error, reload } = useLoad(() => get<Channel[]>('/channels'))
  const [form, setForm] = useState<ChannelKind | null>(null)

  async function remove(c: Channel) {
    try { await del(`/channels/${c.id}`); setData(l => l?.filter(x => x.id !== c.id) ?? l) } catch (e) { toast(errText(e), 'err') }
  }
  if (error) return <ErrorBox text={error} retry={reload} />
  return (
    <>
      <div className="o2-page-h"><h1 className="o2-h1">{P.title}</h1></div>
      <div className="o2-ch-grid">
        {KINDS.map(k => {
          const list = (data ?? []).filter(c => c.kind === k)
          return (
            <section key={k} className={`o2-card o2-chcard ${k}`}>
              <div className="o2-card-h"><span className={`o2-ch big ${k}`}><ChIcon kind={k} size={18} /></span><b>{t.channels[k]}</b><span className="o2-flex" />
                <button className="o2-btn sm ghost" onClick={() => setForm(form === k ? null : k)}><Plus size={13} /> {P.connect}</button></div>
              <p className="o2-muted sm">{P.hints[k]}</p>
              {!data ? <Skeleton rows={2} /> : list.length === 0 ? <p className="o2-muted">{P.none}</p> : list.map(c => <ChannelRow key={c.id} c={c} onRemove={() => void remove(c)} />)}
              {form === k && <ConnectForm kind={k} onDone={c => { setData(l => [...(l ?? []), c]); setForm(null) }} onClose={() => setForm(null)} />}
            </section>
          )
        })}
      </div>
    </>
  )
}

function ChannelRow({ c, onRemove }: { c: Channel; onRemove: () => void }) {
  const toast = useToast()
  const snippet = c.widgetKey ? `<script src="${location.origin}/widget.js" data-key="${c.widgetKey}"></script>` : ''
  return (
    <div className="o2-chrow">
      <div className="o2-row"><b>{c.name}</b><span className={`o2-tag st-${c.status}`}>{P[c.status]}</span><small className="o2-muted">{when(c.createdAt)}</small><span className="o2-flex" />
        <button className="o2-icon-btn sm" onClick={onRemove} aria-label={P.remove} title={P.remove}><Trash2 size={14} /></button></div>
      {c.info && <small className="o2-muted">{c.info}</small>}
      {c.webhookUrl && <CopyLine label={P.webhook} value={c.webhookUrl} onCopy={() => void copy(c.webhookUrl!, toast)} />}
      {c.widgetKey && <>
        <CopyLine label={P.widgetKey} value={c.widgetKey} onCopy={() => void copy(c.widgetKey!, toast)} />
        <CopyLine label={P.embed} value={snippet} onCopy={() => void copy(snippet, toast)} />
      </>}
    </div>
  )
}

function CopyLine({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return <div className="o2-copy"><small>{label}</small><code>{value}</code><button className="o2-icon-btn sm" onClick={onCopy} aria-label={t.common.copy}><Copy size={13} /></button></div>
}

function ConnectForm({ kind, onDone, onClose }: { kind: ChannelKind; onDone: (c: Channel) => void; onClose: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(t.channels[kind] ?? kind)
  const [cfg, setCfg] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    try { onDone(await post<Channel>('/channels', { kind, name, config: cfg })) } catch (er) { toast(errText(er), 'err') } finally { setBusy(false) }
  }
  return (
    <form className="o2-form o2-chform" onSubmit={submit}>
      <label className="o2-field"><span>{t.common.name}</span><input required value={name} onChange={e => setName(e.target.value)} /></label>
      {FIELDS[kind].map(f => (
        <label key={f} className="o2-field"><span>{P.fields[f] ?? f}</span><input value={cfg[f] ?? ''} type={f === 'token' ? 'password' : 'text'} autoComplete="off" onChange={e => setCfg({ ...cfg, [f]: e.target.value })} /></label>
      ))}
      <div className="o2-row end"><button type="button" className="o2-btn ghost sm" onClick={onClose}>{t.common.cancel}</button><button className="o2-btn primary sm" disabled={busy}>{P.connect}</button></div>
    </form>
  )
}
