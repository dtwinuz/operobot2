import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react'
import { AlarmClock, Plus, Search, Sparkles, X } from 'lucide-react'
import { get, patch, post } from '../api/client'
import type { Lead, Stage } from '../api/types'
import { t } from '../i18n'
import { ChIcon, ErrorBox, errText, go, money, Skeleton, useLoad, useToast, when } from '../lib'
import { useApp } from './ctx'

const B = t.board
const TONE: Record<string, string> = { yuqori: 'ok', "o'rta": 'amber', past: 'hot' }

export function BoardPage() {
  const { on } = useApp()
  const toast = useToast()
  const st = useLoad(() => get<Stage[]>('/stages'))
  const ld = useLoad(() => get<Lead[]>('/leads'))
  const setLeads = ld.setData
  const [q, setQ] = useState('')
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => on(e => {
    if (e.type === 'lead') setLeads(list => (list ? (list.some(l => l.id === e.data.id) ? list.map(l => (l.id === e.data.id ? e.data : l)) : [e.data, ...list]) : list))
  }), [on, setLeads])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = ld.data ?? []
    return s ? list.filter(l => `${l.title} ${l.contact.name} ${l.contact.phone ?? ''} ${l.assigneeName ?? ''}`.toLowerCase().includes(s)) : list
  }, [ld.data, q])

  async function move(id: string, stageId: string) {
    const prev = ld.data
    setLeads(list => list?.map(l => (l.id === id ? { ...l, stageId } : l)) ?? list)
    try { const l = await patch<Lead>(`/leads/${id}`, { stageId }); setLeads(list => list?.map(x => (x.id === id ? l : x)) ?? list) }
    catch (e) { setLeads(prev); toast(errText(e), 'err') }
  }
  const drop = (sid: string) => (e: DragEvent) => { e.preventDefault(); setOver(null); if (drag) void move(drag, sid); setDrag(null) }

  if (st.error || ld.error) return <ErrorBox text={(st.error ?? ld.error)!} retry={() => { st.reload(); ld.reload() }} />
  const stages = st.data ?? []
  const now = Date.now()

  return (
    <>
      <div className="o2-page-h">
        <h1 className="o2-h1">{t.shell.nav.board}</h1><span className="o2-mono">{ld.data?.length ?? ''}</span>
        <span className="o2-flex" />
        <label className="o2-search"><Search size={14} /><input value={q} placeholder={t.common.search} onChange={e => setQ(e.target.value)} /></label>
        <button className="o2-btn primary sm" onClick={() => setAdding(true)}><Plus size={14} /> {B.newLead.replace('+ ', '')}</button>
      </div>
      {adding && <NewLead onClose={() => setAdding(false)} onDone={l => { setLeads(list => [l, ...(list ?? [])]); setAdding(false) }} />}
      {!st.data || !ld.data ? <div className="o2-kanban">{Array.from({ length: 5 }, (_, i) => <div key={i} className="o2-col"><Skeleton rows={4} /></div>)}</div> : (
        <div className="o2-kanban">
          {stages.map(s => {
            const list = shown.filter(l => l.stageId === s.id)
            const sum = list.reduce((a, l) => a + (l.value ?? 0), 0)
            return (
              <div key={s.id} className={`o2-col${over === s.id ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(s.id) }} onDragLeave={() => setOver(o => (o === s.id ? null : o))} onDrop={drop(s.id)}>
                <div className="o2-col-h" style={{ borderColor: s.color }}><span className="o2-dot" style={{ background: s.color }} /><b>{s.name}</b><span className="o2-mono">{list.length}</span>{sum > 0 && <small className="o2-mono">{money(sum)}</small>}</div>
                {list.length === 0 && <p className="o2-col-empty">{B.noCards}</p>}
                {list.map(l => {
                  const late = l.dueAt && Date.parse(l.dueAt) <= now
                  return (
                    <article key={l.id} className={`o2-lead${drag === l.id ? ' drag' : ''}`} draggable
                      onDragStart={e => { setDrag(l.id); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { setDrag(null); setOver(null) }}
                      onClick={() => { if (l.conversationId) go(`/app/inbox/${l.conversationId}`) }}>
                      <div className="o2-lead-h"><span className="o2-src" title={t.channels[l.source]}><ChIcon kind={l.source} size={12} /></span><b>{l.contact.name}</b>{l.value != null && <small className="o2-mono">{money(l.value)}</small>}</div>
                      <p className="o2-lead-t">{l.title}</p>
                      {l.summary && <p className="o2-lead-x"><Sparkles size={11} /> {l.summary}</p>}
                      <div className="o2-row">
                        {l.interest && <span className={`o2-tag ${TONE[l.interest] ?? ''}`}>{t.interest[l.interest]}</span>}
                        {l.dueAt && <span className={`o2-tag ${late ? 'hot' : 'acc'}`} title={l.nextAction ?? ''}><AlarmClock size={10} /> {when(l.dueAt)}</span>}
                        {l.assigneeName && <span className="o2-tag mute">{l.assigneeName}</span>}
                      </div>
                      <select className="o2-move" aria-label={B.moveTo} value={l.stageId} onClick={e => e.stopPropagation()} onChange={e => void move(l.id, e.target.value)}>
                        {stages.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </article>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function NewLead({ onClose, onDone }: { onClose: () => void; onDone: (l: Lead) => void }) {
  const toast = useToast()
  const [f, setF] = useState({ title: '', name: '', phone: '', value: '' })
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    try {
      onDone(await post<Lead>('/leads', { title: f.title, name: f.name, phone: f.phone || undefined, value: f.value ? Number(f.value.replace(/\s/g, '')) : undefined }))
    } catch (er) { toast(errText(er), 'err') } finally { setBusy(false) }
  }
  return (
    <form className="o2-card o2-inline-form" onSubmit={submit}>
      <label className="o2-field"><span>{B.title}</span><input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></label>
      <label className="o2-field"><span>{t.common.name}</span><input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
      <label className="o2-field"><span>{t.common.phone}</span><input value={f.phone} placeholder="+998 00 000 00 00" onChange={e => setF({ ...f, phone: e.target.value })} /></label>
      <label className="o2-field"><span>{B.value}</span><input inputMode="numeric" value={f.value} onChange={e => setF({ ...f, value: e.target.value })} /></label>
      <div className="o2-row end"><button type="button" className="o2-btn ghost sm" onClick={onClose}><X size={14} /> {t.common.cancel}</button><button className="o2-btn primary sm" disabled={busy}>{t.common.create}</button></div>
    </form>
  )
}
