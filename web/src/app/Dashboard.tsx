import { useEffect, useRef, type ReactNode } from 'react'
import { Bot, Clock, Inbox, PhoneCall, PhoneForwarded, Send, Trophy, UserPlus } from 'lucide-react'
import { get } from '../api/client'
import type { Stats } from '../api/types'
import { t } from '../i18n'
import { ChIcon, ErrorBox, num, Skeleton, useLoad } from '../lib'
import { useApp } from './ctx'

const D = t.dash

export function Dashboard() {
  const { on } = useApp()
  const { data, error, loading, reload } = useLoad(() => get<Stats>('/stats'))
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => on(e => {
    if (e.type === 'message' || e.type === 'lead' || e.type === 'call') {
      clearTimeout(timer.current)
      timer.current = setTimeout(reload, 1500)
    }
  }), [on, reload])
  useEffect(() => () => clearTimeout(timer.current), [])

  if (error && !data) return <ErrorBox text={error} retry={reload} />
  if (loading && !data) return <><h1 className="o2-h1">{D.title}</h1><div className="o2-kpis">{Array.from({ length: 8 }, (_, i) => <div key={i} className="o2-kpi"><Skeleton rows={2} /></div>)}</div></>
  const s = data!
  const k = s.today
  const tiles = [
    { l: D.inbound, v: num(k.inbound), i: <Inbox size={16} />, c: 'acc' },
    { l: D.outbound, v: num(k.outbound), i: <Send size={16} />, c: 'acc' },
    { l: D.aiReplies, v: num(k.aiReplies), i: <Bot size={16} />, c: 'sec' },
    { l: D.firstReply, v: k.firstReplySec == null ? '—' : `${Math.round(k.firstReplySec)} ${D.sec}`, i: <Clock size={16} />, c: 'sec' },
    { l: D.calls, v: num(k.calls), i: <PhoneCall size={16} />, c: 'amber' },
    { l: D.connected, v: num(k.connected), i: <PhoneForwarded size={16} />, c: 'amber' },
    { l: D.newLeads, v: num(k.newLeads), i: <UserPlus size={16} />, c: 'ok' },
    { l: D.won, v: num(k.won), i: <Trophy size={16} />, c: 'ok' },
  ]
  return (
    <>
      <div className="o2-page-h"><h1 className="o2-h1">{D.title}</h1><span className="o2-dot-live">{t.common.live}</span></div>
      <div className="o2-kpis">
        {tiles.map(x => <div key={x.l} className={`o2-kpi ${x.c}`}><span className="o2-kpi-i">{x.i}</span><small>{x.l}</small><b>{x.v}</b></div>)}
      </div>
      <div className="o2-dash-grid">
        <section className="o2-card wide"><div className="o2-card-h"><b>{D.hourly}</b><span className="o2-legend"><i className="acc" />{D.msgs}<i className="amber" />{D.callsL}</span></div><Hourly data={s.hourly} /></section>
        <section className="o2-card">
          <div className="o2-card-h"><b>{D.byChannel}</b></div>
          <Bars rows={s.byChannel.map(c => ({ key: c.kind, label: t.channels[c.kind] ?? c.kind, value: c.count, icon: <ChIcon kind={c.kind} size={13} /> }))} />
        </section>
        <section className="o2-card">
          <div className="o2-card-h"><b>{D.funnel}</b></div>
          <Bars rows={s.funnel.map(f => ({ key: f.stageId, label: f.name, value: f.count, color: f.color }))} />
        </section>
      </div>
    </>
  )
}

function Hourly({ data }: { data: Stats['hourly'] }) {
  const hours = Array.from({ length: 24 }, (_, h) => data.find(d => d.h === h) ?? { h, inbound: 0, calls: 0 })
  const max = Math.max(1, ...hours.map(h => Math.max(h.inbound, h.calls)))
  const W = 1000, H = 170, pad = 24, bw = (W - pad) / 24
  return (
    <svg className="o2-chart" viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label={D.hourly}>
      {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1={pad} x2={W} y1={H - (H - 10) * f} y2={H - (H - 10) * f} className="grid" />)}
      <rect x={pad + 9 * bw} y={0} width={9 * bw} height={H} className="window" />
      {hours.map(h => {
        const x = pad + h.h * bw
        const a = ((H - 10) * h.inbound) / max, b = ((H - 10) * h.calls) / max
        return (
          <g key={h.h}>
            <rect x={x + 2} y={H - a} width={bw / 2 - 2} height={a} rx={2} className="bar acc"><title>{`${h.h}:00 · ${h.inbound} ${D.msgs}`}</title></rect>
            <rect x={x + bw / 2} y={H - b} width={bw / 2 - 2} height={b} rx={2} className="bar amber"><title>{`${h.h}:00 · ${h.calls} ${D.callsL}`}</title></rect>
            {h.h % 3 === 0 && <text x={x + bw / 2} y={H + 15} textAnchor="middle">{String(h.h).padStart(2, '0')}</text>}
          </g>
        )
      })}
      <text x={pad} y={10} className="max">{max}</text>
    </svg>
  )
}

function Bars({ rows }: { rows: { key: string; label: string; value: number; color?: string; icon?: ReactNode }[] }) {
  if (!rows.length) return <p className="o2-muted">{t.common.empty}</p>
  const max = Math.max(1, ...rows.map(r => r.value))
  return (
    <ul className="o2-bars">
      {rows.map(r => (
        <li key={r.key}>
          <span className="o2-bars-l">{r.icon}{r.label}</span>
          <span className="o2-bars-t"><i style={{ width: `${(r.value / max) * 100}%`, background: r.color }} /></span>
          <b>{num(r.value)}</b>
        </li>
      ))}
    </ul>
  )
}
