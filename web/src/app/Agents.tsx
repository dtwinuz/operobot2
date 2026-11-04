import { useEffect, useState, type FormEvent } from 'react'
import { Bot, Mic, Plus, Send } from 'lucide-react'
import { get, patch, post } from '../api/client'
import type { Agent, AgentTest, Channel } from '../api/types'
import { t } from '../i18n'
import { ChBadge, Empty, ErrorBox, errText, Skeleton, useLoad, useToast } from '../lib'

const A = t.agents
type Draft = Omit<Agent, 'id' | 'stats'>
const blank: Draft = { name: 'Yangi agent', kind: 'chat', enabled: false, prompt: '', greeting: 'Assalomu alaykum! Qanday yordam bera olaman?', handoff: ['operator'], channelIds: [], voice: null }

export function AgentsPage() {
  const toast = useToast()
  const { data, setData, error, reload } = useLoad(() => get<Agent[]>('/agents'))
  const [channels, setChannels] = useState<Channel[]>([])
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => { get<Channel[]>('/channels').then(setChannels).catch(() => {}) }, [])
  useEffect(() => { if (data?.length && !sel) setSel(data[0]!.id) }, [data, sel])

  async function create() {
    try { const a = await post<Agent>('/agents', blank); setData(l => [...(l ?? []), a]); setSel(a.id) } catch (e) { toast(errText(e), 'err') }
  }
  if (error) return <ErrorBox text={error} retry={reload} />
  const cur = data?.find(a => a.id === sel) ?? null
  return (
    <>
      <div className="o2-page-h"><h1 className="o2-h1">{A.title}</h1><span className="o2-flex" /><button className="o2-btn primary sm" onClick={() => void create()}><Plus size={14} /> {A.create}</button></div>
      <div className="o2-agents">
        <div className="o2-agent-list">
          {!data ? <Skeleton rows={4} /> : !data.length ? <Empty icon={<Bot size={22} />} /> : data.map(a => (
            <button key={a.id} className={`o2-agent-i${a.id === sel ? ' on' : ''}`} onClick={() => setSel(a.id)}>
              <span className={`o2-agent-ic ${a.kind}`}>{a.kind === 'voice' ? <Mic size={16} /> : <Bot size={16} />}</span>
              <span><b>{a.name}</b><small>{a.kind === 'voice' ? A.voice : A.chat} · {a.stats.replies} {A.replies} · {a.stats.handoffs} {A.handoffs}</small></span>
              <i className={`o2-dot ${a.enabled ? 'on' : ''}`} />
            </button>
          ))}
        </div>
        {cur ? <Editor key={cur.id} agent={cur} channels={channels} onSaved={a => setData(l => l?.map(x => (x.id === a.id ? a : x)) ?? l)} /> : <div className="o2-card"><Empty text={A.pick} /></div>}
      </div>
    </>
  )
}

function Editor({ agent, channels, onSaved }: { agent: Agent; channels: Channel[]; onSaved: (a: Agent) => void }) {
  const toast = useToast()
  const [d, setD] = useState<Draft>({ name: agent.name, kind: agent.kind, enabled: agent.enabled, prompt: agent.prompt, greeting: agent.greeting, handoff: agent.handoff, channelIds: agent.channelIds, voice: agent.voice })
  const [handoff, setHandoff] = useState(agent.handoff.join(', '))
  const [busy, setBusy] = useState(false)
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    try { onSaved(await patch<Agent>(`/agents/${agent.id}`, { ...d, handoff: handoff.split(',').map(s => s.trim()).filter(Boolean) })); toast(t.common.saved, 'ok') }
    catch (er) { toast(errText(er), 'err') } finally { setBusy(false) }
  }
  const toggleCh = (id: string) => setD(x => ({ ...x, channelIds: x.channelIds.includes(id) ? x.channelIds.filter(c => c !== id) : [...x.channelIds, id] }))
  return (
    <div className="o2-agent-edit">
      <form className="o2-card o2-form" onSubmit={save}>
        <div className="o2-grid2">
          <label className="o2-field"><span>{t.common.name}</span><input required value={d.name} onChange={e => setD({ ...d, name: e.target.value })} /></label>
          <label className="o2-field"><span>{A.kind}</span>
            <select value={d.kind} onChange={e => setD({ ...d, kind: e.target.value as Agent['kind'] })}><option value="chat">{A.chat}</option><option value="voice">{A.voice}</option></select>
          </label>
        </div>
        <label className="o2-switch"><input type="checkbox" checked={d.enabled} onChange={e => setD({ ...d, enabled: e.target.checked })} /><i /><span>{A.enabled}</span></label>
        <label className="o2-field"><span>{A.greeting}</span><input value={d.greeting} onChange={e => setD({ ...d, greeting: e.target.value })} /></label>
        <label className="o2-field"><span>{A.prompt}</span><textarea rows={8} value={d.prompt} onChange={e => setD({ ...d, prompt: e.target.value })} /></label>
        <label className="o2-field"><span>{A.handoff}</span><input value={handoff} onChange={e => setHandoff(e.target.value)} /></label>
        {d.kind === 'voice' && <label className="o2-field"><span>{A.voiceName}</span><input value={d.voice ?? ''} placeholder="uz-UZ-MadinaNeural" onChange={e => setD({ ...d, voice: e.target.value || null })} /></label>}
        {d.kind === 'chat' && (
          <div className="o2-field"><span>{A.channels}</span>
            <div className="o2-chips">
              {channels.length ? channels.map(c => <label key={c.id} className={`o2-chip${d.channelIds.includes(c.id) ? ' on' : ''}`}><input type="checkbox" checked={d.channelIds.includes(c.id)} onChange={() => toggleCh(c.id)} /><ChBadge kind={c.kind} /> {c.name}</label>) : <small className="o2-muted">{t.channelsP.none}</small>}
            </div>
          </div>
        )}
        <div className="o2-row end"><button className="o2-btn primary sm" disabled={busy}>{t.common.save}</button></div>
      </form>
      <TestBox agentId={agent.id} greeting={d.greeting} />
    </div>
  )
}

type Line = { who: 'in' | 'ai' | 'sys'; text: string }
function TestBox({ agentId, greeting }: { agentId: string; greeting: string }) {
  const toast = useToast()
  const [lines, setLines] = useState<Line[]>([{ who: 'ai', text: greeting }])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  async function send(e: FormEvent) {
    e.preventDefault()
    const m = text.trim(); if (!m) return
    setLines(l => [...l, { who: 'in', text: m }]); setText(''); setBusy(true)
    try {
      const r = await post<AgentTest>(`/agents/${agentId}/test`, { text: m })
      const ex = Object.entries(r.extracted).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')
      setLines(l => [...l, { who: 'ai', text: r.reply }, { who: 'sys', text: `${A.action}: ${A.actions[r.action] ?? r.action}${ex ? ` · ${A.extracted}: ${ex}` : ''}` }])
    } catch (er) { toast(errText(er), 'err') } finally { setBusy(false) }
  }
  return (
    <div className="o2-card o2-test">
      <div className="o2-card-h"><b>{A.test}</b></div>
      <div className="o2-msgs sm">{lines.map((l, i) => <div key={i} className={`o2-msg ${l.who === 'in' ? 'contact' : l.who === 'ai' ? 'ai' : 'system'}`}><p>{l.text}</p></div>)}{busy && <div className="o2-msg ai typing"><p>…</p></div>}</div>
      <form className="o2-composer row" onSubmit={send}><input value={text} placeholder={A.testPh} onChange={e => setText(e.target.value)} /><button className="o2-btn primary sm" disabled={busy || !text.trim()} aria-label={t.inbox.send}><Send size={14} /></button></form>
    </div>
  )
}
