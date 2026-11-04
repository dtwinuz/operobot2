import { useEffect, useState, type FormEvent } from 'react'
import { Lock, Pause, Play, Plus, PhoneOutgoing, X } from 'lucide-react'
import { get, post } from '../api/client'
import type { Agent, Call, Campaign } from '../api/types'
import { t } from '../i18n'
import { dur, Empty, ErrorBox, errText, num, Skeleton, useLoad, useToast, when } from '../lib'
import { useApp } from './ctx'

const C = t.calls

export function CallsPage() {
  const { on } = useApp()
  const toast = useToast()
  const camps = useLoad(() => get<Campaign[]>('/campaigns'))
  const calls = useLoad(() => get<Call[]>('/calls?limit=100'))
  const [agents, setAgents] = useState<Agent[]>([])
  const [creating, setCreating] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const setCamps = camps.setData, setCalls = calls.setData

  useEffect(() => { get<Agent[]>('/agents').then(a => setAgents(a.filter(x => x.kind === 'voice'))).catch(() => {}) }, [])
  useEffect(() => on(e => {
    if (e.type === 'campaign') setCamps(l => (l ? (l.some(c => c.id === e.data.id) ? l.map(c => (c.id === e.data.id ? e.data : c)) : [e.data, ...l]) : l))
    if (e.type === 'call') setCalls(l => (l ? (l.some(c => c.id === e.data.id) ? l.map(c => (c.id === e.data.id ? e.data : c)) : [e.data, ...l].slice(0, 200)) : l))
  }), [on, setCamps, setCalls])

  async function act(c: Campaign, a: 'start' | 'pause') {
    try { const x = await post<Campaign>(`/campaigns/${c.id}/${a}`); setCamps(l => l?.map(y => (y.id === x.id ? x : y)) ?? l) } catch (e) { toast(errText(e), 'err') }
  }

  const shownCalls = (calls.data ?? []).filter(c => !sel || c.campaignId === sel)

  return (
    <>
      <div className="o2-page-h"><h1 className="o2-h1">{C.title}</h1><span className="o2-flex" /><button className="o2-btn primary sm" onClick={() => setCreating(true)}><Plus size={14} /> {C.create}</button></div>
      <div className="o2-banner"><Lock size={16} /><span>{C.lock}</span></div>
      {creating && <NewCampaign agents={agents} onClose={() => setCreating(false)} onDone={c => { setCamps(l => [c, ...(l ?? [])]); setCreating(false) }} />}
      {camps.error ? <ErrorBox text={camps.error} retry={camps.reload} /> : !camps.data ? <Skeleton rows={4} /> : !camps.data.length ? <Empty icon={<PhoneOutgoing size={22} />} /> : (
        <div className="o2-camps">
          {camps.data.map(c => {
            const pct = c.total ? (c.called / c.total) * 100 : 0
            return (
              <div key={c.id} className={`o2-camp${sel === c.id ? ' on' : ''}`} onClick={() => setSel(sel === c.id ? null : c.id)}>
                <div className="o2-camp-h"><b>{c.name}</b><span className={`o2-tag camp-${c.status}`}>{t.campaignStatus[c.status]}</span></div>
                <div className="o2-progress"><i style={{ width: `${pct}%` }} /><i className="conn" style={{ width: `${c.total ? (c.connected / c.total) * 100 : 0}%` }} /></div>
                <div className="o2-camp-n">
                  <span><small>{C.total}</small><b>{num(c.total)}</b></span>
                  <span><small>{C.called}</small><b>{num(c.called)}</b></span>
                  <span><small>{C.answered}</small><b>{num(c.answered)}</b></span>
                  <span><small>{C.connected}</small><b className="ok">{num(c.connected)}</b></span>
                </div>
                <div className="o2-row">
                  <small className="o2-muted">{when(c.createdAt)}</small><span className="o2-flex" />
                  {c.status === 'running' ? <button className="o2-btn sm ghost" onClick={e => { e.stopPropagation(); void act(c, 'pause') }}><Pause size={13} /> {C.pause}</button>
                    : c.status !== 'done' && <button className="o2-btn sm primary" onClick={e => { e.stopPropagation(); void act(c, 'start') }}><Play size={13} /> {C.start}</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="o2-card flush">
        <div className="o2-card-h pad"><b>{C.log}</b>{sel && <button className="o2-btn sm ghost" onClick={() => setSel(null)}><X size={12} /> {camps.data?.find(c => c.id === sel)?.name}</button>}</div>
        {calls.error ? <ErrorBox text={calls.error} retry={calls.reload} /> : !calls.data ? <Skeleton rows={6} /> : !shownCalls.length ? <Empty /> : (
          <div className="o2-table-wrap">
            <table className="o2-table">
              <thead><tr><th>{t.common.date}</th><th>{t.common.name}</th><th>{t.common.phone}</th><th>{t.common.status}</th><th>{C.duration}</th><th className="hide-sm">{C.summary}</th></tr></thead>
              <tbody>
                {shownCalls.map(c => (
                  <tr key={c.id}>
                    <td className="o2-mono">{when(c.startedAt)}</td>
                    <td>{c.contact.name}</td>
                    <td className="o2-mono">{c.contact.phone ?? '—'}</td>
                    <td><span className={`o2-tag cs-${c.status}`}>{t.callStatus[c.status]}</span></td>
                    <td className="o2-mono">{dur(c.durationSec)}</td>
                    <td className="hide-sm o2-clip">{c.summary ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function NewCampaign({ agents, onClose, onDone }: { agents: Agent[]; onClose: () => void; onDone: (c: Campaign) => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [agentId, setAgentId] = useState('')
  const [phones, setPhones] = useState('')
  const [busy, setBusy] = useState(false)
  const list = phones.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    try { onDone(await post<Campaign>('/campaigns', { name, agentId: agentId || undefined, phones: list })) } catch (er) { toast(errText(er), 'err') } finally { setBusy(false) }
  }
  return (
    <form className="o2-card o2-inline-form" onSubmit={submit}>
      <label className="o2-field"><span>{C.name}</span><input required value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="o2-field"><span>{C.agent}</span>
        <select value={agentId} onChange={e => setAgentId(e.target.value)}><option value="">{C.noAgent}</option>{agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      </label>
      <label className="o2-field wide"><span>{C.phones} · {list.length} {C.count}</span><textarea required rows={5} className="o2-mono" placeholder={'+998 00 000 00 01\n+998 00 000 00 02'} value={phones} onChange={e => setPhones(e.target.value)} /></label>
      <div className="o2-row end wide"><button type="button" className="o2-btn ghost sm" onClick={onClose}>{t.common.cancel}</button><button className="o2-btn primary sm" disabled={busy || !list.length}>{t.common.create}</button></div>
    </form>
  )
}
