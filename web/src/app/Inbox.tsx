import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Bot, CheckCheck, Headphones, Search, Sparkles, UserCheck, Inbox as InboxIcon } from 'lucide-react'
import { get, patch, post } from '../api/client'
import type { Conversation, Lead, Message, Stage } from '../api/types'
import { t } from '../i18n'
import { ago, Avatar, ChBadge, Empty, ErrorBox, errText, go, hm, money, Skeleton, useLoad, useToast } from '../lib'
import { useApp } from './ctx'

const I = t.inbox
type Filter = 'all' | 'unread' | 'mine' | 'ai'

export function InboxPage({ id }: { id?: string }) {
  const { me, on } = useApp()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const { data: convs, setData: setConvs, error, loading, reload } = useLoad(
    () => get<Conversation[]>(`/conversations?filter=${filter}&q=${encodeURIComponent(q.trim())}`), [filter, q])

  useEffect(() => on(e => {
    if (e.type === 'conversation') {
      setConvs(list => {
        if (!list) return list
        const rest = list.filter(c => c.id !== e.data.id)
        return [e.data, ...rest].sort((a, b) => Date.parse(b.last?.at ?? '0') - Date.parse(a.last?.at ?? '0'))
      })
    } else if (e.type === 'message') {
      setConvs(list => list?.map(c => c.id === e.data.conversationId
        ? { ...c, last: { text: e.data.message.text, at: e.data.message.at, direction: e.data.message.direction }, unread: e.data.message.direction === 'in' && c.id !== id ? c.unread + 1 : c.unread }
        : c).sort((a, b) => Date.parse(b.last?.at ?? '0') - Date.parse(a.last?.at ?? '0')) ?? list)
    }
  }), [on, setConvs, id])

  const current = convs?.find(c => c.id === id) ?? null
  const patchConv = (c: Conversation) => setConvs(list => list?.map(x => (x.id === c.id ? c : x)) ?? list)

  return (
    <div className={`o2-inbox${id ? ' has-thread' : ''}`}>
      <section className="o2-inbox-list">
        <div className="o2-seg sm">
          {(['all', 'unread', 'mine', 'ai'] as Filter[]).map(f => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{I.filters[f]}</button>)}
        </div>
        <label className="o2-search"><Search size={14} /><input value={q} placeholder={t.common.search} onChange={e => setQ(e.target.value)} /></label>
        <div className="o2-conv-list">
          {error && !convs ? <ErrorBox text={error} retry={reload} /> : loading && !convs ? <Skeleton rows={7} /> : !convs?.length ? <Empty text={I.noConv} icon={<InboxIcon size={22} />} /> :
            convs.map(c => (
              <a key={c.id} href={`#/app/inbox/${c.id}`} className={`o2-conv${c.id === id ? ' on' : ''}${c.unread ? ' unread' : ''}`}>
                <span className="o2-conv-av"><Avatar name={c.contact.name} size={36} /><ChBadge kind={c.channel} /></span>
                <span className="o2-conv-b">
                  <span className="o2-conv-t"><b>{c.contact.name}</b><small>{ago(c.last?.at)}</small></span>
                  <span className="o2-conv-m">{c.last?.direction === 'out' && <CheckCheck size={12} />}{c.last?.text ?? '—'}</span>
                  <span className="o2-conv-tags">
                    {c.mode === 'ai' ? <em className="o2-tag acc"><Bot size={10} /> AI</em> : <em className="o2-tag sec"><Headphones size={10} /> {c.assigneeName ?? I.modeHuman}</em>}
                    {c.status === 'closed' && <em className="o2-tag mute">{I.closeConv}</em>}
                  </span>
                </span>
                {c.unread > 0 && <i className="o2-badge">{c.unread}</i>}
              </a>
            ))}
        </div>
      </section>
      {current ? <Thread key={current.id} conv={current} meId={me.user.id} onConv={patchConv} /> : (
        <section className="o2-thread empty">{id && loading ? <Skeleton rows={6} /> : <Empty text={I.pick} icon={<InboxIcon size={28} />} />}</section>
      )}
    </div>
  )
}

function Thread({ conv, meId, onConv }: { conv: Conversation; meId: string; onConv: (c: Conversation) => void }) {
  const { on } = useApp()
  const toast = useToast()
  const [msgs, setMsgs] = useState<Message[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [sugg, setSugg] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let dead = false
    get<Message[]>(`/conversations/${conv.id}/messages`).then(m => { if (!dead) { setMsgs(m); onConv({ ...conv, unread: 0 }) } }).catch(e => !dead && setErr(errText(e)))
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.id])
  useEffect(() => on(e => {
    if (e.type === 'message' && e.data.conversationId === conv.id) setMsgs(m => (m && !m.some(x => x.id === e.data.message.id) ? [...m, e.data.message] : m))
  }), [on, conv.id])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs?.length])

  async function send(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setBusy(true)
    try {
      const m = await post<Message>(`/conversations/${conv.id}/messages`, { text: body })
      setMsgs(list => (list && !list.some(x => x.id === m.id) ? [...list, m] : list))
      setText('')
      if (conv.mode === 'ai') onConv({ ...conv, mode: 'human' })
    } catch (er) { toast(errText(er), 'err') } finally { setBusy(false) }
  }
  async function suggest() {
    setSugg(true)
    try { const r = await post<{ text: string }>(`/conversations/${conv.id}/suggest`); setText(r.text) } catch (er) { toast(errText(er), 'err') } finally { setSugg(false) }
  }
  async function upd(body: Partial<Pick<Conversation, 'mode' | 'assigneeId' | 'status'>>) {
    try { onConv(await patch<Conversation>(`/conversations/${conv.id}`, body)) } catch (er) { toast(errText(er), 'err') }
  }

  return (
    <>
      <section className="o2-thread">
        <header className="o2-thread-h">
          <button className="o2-icon-btn show-md" onClick={() => go('/app/inbox')} aria-label={I.back}><ArrowLeft size={18} /></button>
          <Avatar name={conv.contact.name} size={34} />
          <div className="o2-thread-who"><b>{conv.contact.name}</b><small><ChBadge kind={conv.channel} /> {conv.channelName}{conv.contact.phone ? ` · ${conv.contact.phone}` : ''}</small></div>
          <span className="o2-flex" />
          <div className="o2-seg sm" role="group">
            <button className={conv.mode === 'ai' ? 'on' : ''} onClick={() => void upd({ mode: 'ai' })}><Bot size={13} /> {I.modeAi}</button>
            <button className={conv.mode === 'human' ? 'on' : ''} onClick={() => void upd({ mode: 'human' })}><Headphones size={13} /> {I.modeHuman}</button>
          </div>
          {conv.assigneeId !== meId && <button className="o2-btn sm ghost hide-sm" onClick={() => void upd({ assigneeId: meId, mode: 'human' })}><UserCheck size={14} /> {I.assignMe}</button>}
          <button className="o2-btn sm ghost" onClick={() => void upd({ status: conv.status === 'open' ? 'closed' : 'open' })}>{conv.status === 'open' ? I.closeConv : I.reopen}</button>
        </header>
        <div className={`o2-mode-bar ${conv.mode}`}>{conv.mode === 'ai' ? <><Bot size={13} /> {I.aiMode}</> : <><Headphones size={13} /> {I.humanMode}{conv.assigneeName ? ` · ${conv.assigneeName}` : ''}</>}</div>
        <div className="o2-msgs">
          {err ? <ErrorBox text={err} /> : !msgs ? <Skeleton rows={6} /> : msgs.map(m => (
            <div key={m.id} className={`o2-msg ${m.author}${m.status === 'failed' ? ' failed' : ''}`}>
              {m.author !== 'system' && <small>{m.author === 'user' ? (m.userName ?? I.author.user) : I.author[m.author]}</small>}
              <p>{m.author === 'ai' && <Sparkles size={11} />} {m.text}</p>
              <time>{hm(m.at)}{m.status === 'failed' ? ` · ${I.failed}` : m.status === 'demo' ? ' · demo' : ''}</time>
            </div>
          ))}
          <div ref={end} />
        </div>
        <form className="o2-composer" onSubmit={send}>
          <textarea rows={2} value={text} placeholder={I.placeholder} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(e) } }} />
          <div className="o2-composer-a">
            <button type="button" className="o2-btn sm ghost" disabled={sugg} onClick={() => void suggest()}><Sparkles size={14} /> {sugg ? t.common.loading : I.suggest}</button>
            <button className="o2-btn sm primary" disabled={busy || !text.trim()}>{I.send}</button>
          </div>
        </form>
      </section>
      <SidePanel conv={conv} />
    </>
  )
}

function SidePanel({ conv }: { conv: Conversation }) {
  const toast = useToast()
  const { on } = useApp()
  const [stages, setStages] = useState<Stage[]>([])
  const [lead, setLead] = useState<Lead | null>(null)
  useEffect(() => { get<Stage[]>('/stages').then(setStages).catch(() => {}) }, [])
  useEffect(() => {
    setLead(null)
    if (!conv.leadId) return
    get<Lead[]>('/leads').then(l => setLead(l.find(x => x.id === conv.leadId) ?? null)).catch(() => {})
  }, [conv.leadId])
  useEffect(() => on(e => { if (e.type === 'lead' && e.data.id === conv.leadId) setLead(e.data) }), [on, conv.leadId])
  const stage = useMemo(() => stages.find(s => s.id === lead?.stageId), [stages, lead])

  return (
    <aside className="o2-inbox-side">
      <div className="o2-card">
        <div className="o2-card-h"><b>{I.contact}</b></div>
        <div className="o2-kv">
          <span>{t.common.name}</span><b>{conv.contact.name}</b>
          <span>{t.common.phone}</span><b className="o2-mono">{conv.contact.phone ?? '—'}</b>
          {conv.contact.username && <><span>@</span><b>{conv.contact.username}</b></>}
          <span>{I.assignee}</span><b>{conv.assigneeName ?? '—'}</b>
        </div>
      </div>
      <div className="o2-card">
        <div className="o2-card-h"><b>{I.lead}</b>{stage && <span className="o2-dot" style={{ background: stage.color }} />}</div>
        {!lead ? <p className="o2-muted">{I.noLead}</p> : (
          <>
            <p className="o2-lead-t">{lead.title}</p>
            <select className="o2-input" value={lead.stageId} onChange={async e => {
              try { setLead(await patch<Lead>(`/leads/${lead.id}`, { stageId: e.target.value })) } catch (er) { toast(errText(er), 'err') }
            }}>{stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <div className="o2-kv">
              <span>{t.board.value}</span><b>{money(lead.value)}</b>
              {lead.nextAction && <><span>{t.board.next}</span><b>{lead.nextAction}</b></>}
            </div>
            {lead.summary && <p className="o2-sum"><Sparkles size={12} /> {lead.summary}</p>}
          </>
        )}
      </div>
    </aside>
  )
}
