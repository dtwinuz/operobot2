import { useEffect, useState } from 'react'
import { Check, CreditCard } from 'lucide-react'
import { get, post } from '../api/client'
import type { Billing, Invoice, Limits, Plan } from '../api/types'
import { t } from '../i18n'
import { ErrorBox, errText, money, num, Skeleton, useLoad, useToast, when } from '../lib'
import { useApp } from './ctx'

const B = t.billing
const KEYS: (keyof Limits)[] = ['operators', 'channels', 'messages', 'aiReplies', 'callMinutes']

export function BillingPage() {
  const { on, reloadMe } = useApp()
  const toast = useToast()
  const { data, setData, error, reload } = useLoad(() => get<Billing>('/billing'))
  const [yearly, setYearly] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => on(e => { if (e.type === 'usage') setData(b => (b ? { ...b, usage: e.data } : b)) }), [on, setData])

  async function checkout(p: Plan, provider: 'payme' | 'click') {
    setBusy(`${p.key}:${provider}`)
    try {
      const r = await post<{ invoice: Invoice; payUrl: string | null }>('/billing/checkout', { plan: p.key, months: yearly ? 12 : 1, provider })
      if (r.payUrl) window.open(r.payUrl, '_blank', 'noopener')
      else toast(B.paidDemo, 'ok')
      reload(); reloadMe()
    } catch (e) { toast(errText(e), 'err') } finally { setBusy(null) }
  }

  if (error) return <ErrorBox text={error} retry={reload} />
  if (!data) return <Skeleton rows={8} />
  const b = data
  return (
    <>
      <div className="o2-page-h"><h1 className="o2-h1">{B.title}</h1></div>
      <div className="o2-bill-top">
        <section className="o2-card">
          <div className="o2-card-h"><CreditCard size={15} /><b>{B.current}</b></div>
          <div className="o2-bill-plan"><strong>{b.plan.name}</strong><span>{b.plan.priceMonth == null ? t.landing.priceAsk : money(b.plan.priceMonth) + '/oy'}</span></div>
          <small className="o2-muted">{B.period}: {when(b.periodStart)} — {when(b.periodEnd)}</small>
        </section>
        <section className="o2-card">
          <div className="o2-card-h"><b>{B.usage}</b></div>
          <div className="o2-meters">
            {KEYS.map(k => {
              const lim = b.plan.limits[k], used = b.usage[k]
              const pct = lim < 0 ? 0 : lim === 0 ? (used > 0 ? 100 : 0) : Math.min(100, (used / lim) * 100)
              return (
                <div key={k} className={`o2-meter${pct >= 90 ? ' hot' : pct >= 70 ? ' warn' : ''}`}>
                  <span><small>{B.limits[k]}</small><b>{num(used)} / {lim < 0 ? t.common.unlimited : num(lim)}</b></span>
                  <i><em style={{ width: `${lim < 0 ? 4 : pct}%` }} /></i>
                </div>
              )
            })}
          </div>
        </section>
      </div>
      <div className="o2-seg"><button className={!yearly ? 'on' : ''} onClick={() => setYearly(false)}>{B.monthly}</button><button className={yearly ? 'on' : ''} onClick={() => setYearly(true)}>{B.yearly}</button></div>
      <div className="o2-plans in-app">
        {b.plans.map(p => {
          const cur = p.key === b.plan.key
          const price = p.priceMonth == null ? null : Math.round(p.priceMonth * (yearly ? 0.8 : 1))
          return (
            <div key={p.key} className={`o2-plan${cur ? ' cur' : ''}`}>
              <div className="o2-plan-h"><b>{p.name}</b>{cur ? <span className="o2-tag acc">{B.currentChip}</span> : price ? <span className="o2-tag mute">{t.common.demoChip}</span> : null}</div>
              <div className="o2-plan-p">{price == null ? <strong>{t.landing.priceAsk}</strong> : <><strong>{num(price)}</strong><small>{t.common.perMonth}</small></>}</div>
              <ul>
                {KEYS.map(k => <li key={k}><Check size={13} /> {B.limits[k]}: {p.limits[k] < 0 ? t.common.unlimited : num(p.limits[k])}</li>)}
                {p.features.map(f => <li key={f}><Check size={13} /> {f}</li>)}
              </ul>
              {!cur && price != null && price > 0 && (
                <div className="o2-row">
                  <button className="o2-btn sm pay payme" disabled={!!busy} onClick={() => void checkout(p, 'payme')}>{busy === `${p.key}:payme` ? '…' : 'Payme'}</button>
                  <button className="o2-btn sm pay click" disabled={!!busy} onClick={() => void checkout(p, 'click')}>{busy === `${p.key}:click` ? '…' : 'Click'}</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="o2-card flush">
        <div className="o2-card-h pad"><b>{B.invoices}</b></div>
        {!b.invoices.length ? <p className="o2-muted pad">{t.common.empty}</p> : (
          <div className="o2-table-wrap">
            <table className="o2-table">
              <thead><tr><th>{t.common.date}</th><th>{t.shell.nav.billing}</th><th>{B.amount}</th><th>{B.provider}</th><th>{t.common.status}</th></tr></thead>
              <tbody>{b.invoices.map(i => (
                <tr key={i.id}><td className="o2-mono">{when(i.createdAt)}</td><td>{i.plan} · {i.months} {B.months}</td><td className="o2-mono">{money(i.amount)}</td><td>{i.provider}</td><td><span className={`o2-tag inv-${i.status}`}>{B.invStatus[i.status]}</span></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
