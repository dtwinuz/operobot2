import { useEffect, useState } from 'react'
import { ArrowRight, Bot, Check, ChevronDown, Clock, KanbanSquare, Lock, Moon, PhoneOutgoing, ShieldCheck, Sparkles, Sun, Inbox as InboxIcon, Server, Languages } from 'lucide-react'
import { t } from '../i18n'
import { ChBadge, ChIcon, errText, num, useTheme, useToast } from '../lib'
import { openDemo } from '../demo'

const L = t.landing

function Logo() {
  return <a className="o2-logo" href="#/"><img src="/favicon.svg" alt="" width={26} height={26} /><b>operobot</b><i>2</i></a>
}

function DemoButton({ big }: { big?: boolean }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  return (
    <button className={`o2-btn primary${big ? ' lg' : ''}`} disabled={busy} onClick={async () => {
      setBusy(true)
      try { await openDemo() } catch (e) { toast(errText(e), 'err'); setBusy(false) }
    }}>{busy ? L.demoBusy : L.demo} <ArrowRight size={16} /></button>
  )
}

/* ---------- live product mock ---------- */
const FEED = [
  { ch: 'telegram', who: 'Dilnoza R.', text: 'Assalomu alaykum, narxlar qancha?' },
  { ch: 'ai', who: 'AI agent', text: 'Va alaykum assalom! Bepul ko‘rik bor, juma 15:00 ga yozib qo‘yaymi?' },
  { ch: 'instagram', who: 'Jasur T.', text: 'Manzilingiz qayerda?' },
  { ch: 'ai', who: 'AI agent', text: 'Chilonzor, 9-kvartal. Xaritani yubordim 📍' },
  { ch: 'whatsapp', who: 'Nodira K.', text: 'Shartnoma bo‘yicha operator bilan gaplashsam bo‘ladimi?' },
  { ch: 'handoff', who: 'Tizim', text: 'Operatorga uzatildi · Mohira' },
]
const COLS = ['Yangi', 'Qiziqdi', 'Uchrashuv', 'Yutildi']

function LiveMock() {
  const [n, setN] = useState(1)
  const [stage, setStage] = useState(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(FEED.length); setStage(2); return }
    const a = setInterval(() => setN(x => (x >= FEED.length ? 1 : x + 1)), 1700)
    const b = setInterval(() => setStage(s => (s + 1) % COLS.length), 2600)
    return () => { clearInterval(a); clearInterval(b) }
  }, [])
  const shown = FEED.slice(Math.max(0, n - 5), n)
  return (
    <div className="o2-mock" aria-hidden="true">
      <div className="o2-mock-bar"><span /><span /><span /><b>operobot2</b><em className="o2-dot-live">{t.common.live}</em></div>
      <div className="o2-mock-body">
        <div className="o2-mock-inbox">
          <div className="o2-mock-h"><InboxIcon size={13} /> {L.mock.inbox}</div>
          {shown.map((m, i) => (
            <div key={i} className={`o2-mock-msg ${m.ch === 'ai' ? 'ai' : m.ch === 'handoff' ? 'sys' : 'in'}`}>
              {m.ch === 'ai' ? <Bot size={12} /> : m.ch === 'handoff' ? <PhoneOutgoing size={12} /> : <ChIcon kind={m.ch} size={12} />}
              <div><small>{m.who}</small><p>{m.text}</p></div>
            </div>
          ))}
        </div>
        <div className="o2-mock-board">
          <div className="o2-mock-h"><KanbanSquare size={13} /> {L.mock.board}</div>
          <div className="o2-mock-cols">
            {COLS.map((c, i) => (
              <div key={c} className="o2-mock-col">
                <small>{c}</small>
                {i === stage && <div className="o2-mock-card hot"><b>Dilnoza</b><span>15:00</span></div>}
                {i === 1 && stage !== 1 && <div className="o2-mock-card"><b>Ali</b><span>narx</span></div>}
                {i === 3 && stage !== 3 && <div className="o2-mock-card ok"><b>Kamola</b><span>2,4 mln</span></div>}
              </div>
            ))}
          </div>
          <div className="o2-mock-call"><PhoneOutgoing size={13} /><span>Kampaniya «Bahor aksiyasi»</span><b>1</b><em>operatorga ulandi</em></div>
        </div>
      </div>
    </div>
  )
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="o2-faq">
      {L.faq.map((f, i) => (
        <div key={i} className={`o2-faq-i${open === i ? ' open' : ''}`}>
          <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}><span>{f.q}</span><ChevronDown size={18} /></button>
          {open === i && <p>{f.a}</p>}
        </div>
      ))}
    </div>
  )
}

export function Landing() {
  const [theme, toggle] = useTheme()
  const [yearly, setYearly] = useState(false)
  return (
    <div className="o2-land">
      <div className="o2-land-bg" aria-hidden="true"><i /><i /><i /></div>
      <header className="o2-land-h">
        <Logo />
        <nav>
          <a href="#features" onClick={e => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) }}>{L.nav.features}</a>
          <a href="#calls" onClick={e => { e.preventDefault(); document.getElementById('calls')?.scrollIntoView({ behavior: 'smooth' }) }}>{L.nav.calls}</a>
          <a href="#pricing" onClick={e => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }) }}>{L.nav.pricing}</a>
          <a href="#faq" onClick={e => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }) }}>{L.nav.faq}</a>
        </nav>
        <div className="o2-land-act">
          <button className="o2-icon-btn" onClick={toggle} aria-label={t.common.theme}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
          <a className="o2-btn ghost hide-sm" href="#/login">{L.login}</a>
          <a className="o2-btn dark" href="#/signup">{L.signup}</a>
        </div>
      </header>

      <section className="o2-hero">
        <div className="o2-hero-txt">
          <span className="o2-eyebrow"><Sparkles size={13} /> {L.eyebrow}</span>
          <h1>{L.h1a} <em>{L.h1b}</em></h1>
          <p className="o2-hero-lead">{L.lead}</p>
          <div className="o2-hero-cta"><DemoButton big /><a className="o2-btn ghost lg" href="#/signup">{L.signup}</a></div>
          <p className="o2-hero-note">{L.demoNote}</p>
          <ul className="o2-trust">
            <li><Server size={14} /> {L.trust[0]}</li><li><Clock size={14} /> {L.trust[1]}</li><li><Languages size={14} /> {L.trust[2]}</li>
          </ul>
        </div>
        <LiveMock />
      </section>

      <section className="o2-strip">
        <small>{L.channelsTitle}</small>
        <div className="o2-strip-row">
          {['telegram', 'whatsapp', 'instagram', 'sms', 'widget', 'call'].map(k => <span key={k}><ChIcon kind={k} size={16} /> {t.channels[k]}</span>)}
        </div>
      </section>

      <section id="features" className="o2-sec">
        {L.sections.map((s, i) => (
          <article key={s.id} className={`o2-feat${i % 2 ? ' flip' : ''}`}>
            <div className="o2-feat-txt">
              <span className="o2-tag acc">{s.tag}</span>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
              <ul>{s.points.map(p => <li key={p}><Check size={15} /> {p}</li>)}</ul>
            </div>
            <div className="o2-feat-vis">{s.id === 'inbox' ? <VisInbox /> : s.id === 'board' ? <VisBoard /> : <VisAgent />}</div>
          </article>
        ))}
      </section>

      <section id="calls" className="o2-sec o2-calls">
        <div className="o2-calls-in">
          <span className="o2-tag sec">{L.callsTag}</span>
          <h2>{L.callsTitle}</h2>
          <p>{L.callsText}</p>
          <ol className="o2-steps">{L.callsSteps.map((s, i) => <li key={s}><b>{i + 1}</b><span>{s}</span></li>)}</ol>
          <div className="o2-lock"><Lock size={18} /><p>{L.callsLock}</p><div className="o2-lock-clock"><span>09:00</span><i /><span>18:00</span></div></div>
        </div>
      </section>

      <section className="o2-sec">
        <h2 className="o2-center">{L.moreTitle}</h2>
        <div className="o2-grid4">
          {L.more.map((m, i) => (
            <div key={m.t} className="o2-mini">
              <span className="o2-mini-i">{[<KanbanSquare key="a" size={18} />, <Bot key="b" size={18} />, <ShieldCheck key="c" size={18} />, <Sparkles key="d" size={18} />][i]}</span>
              <b>{m.t}</b><p>{m.d}</p>
            </div>
          ))}
        </div>
        <div className="o2-integr">
          <small>{L.integrations}</small>
          {['Telegram', 'WhatsApp', 'Instagram', 'SMS', 'Sayt vidjeti', 'Google Sheets', 'amoCRM', 'Payme', 'Click', 'Claude (MCP)', 'SIP / Asterisk'].map(x => <span key={x}>{x}</span>)}
        </div>
      </section>

      <section id="pricing" className="o2-sec">
        <h2 className="o2-center">{L.pricingTitle}</h2>
        <p className="o2-center o2-sub">{L.pricingText}</p>
        <div className="o2-seg o2-center-x">
          <button className={!yearly ? 'on' : ''} onClick={() => setYearly(false)}>{t.billing.monthly}</button>
          <button className={yearly ? 'on' : ''} onClick={() => setYearly(true)}>{t.billing.yearly}</button>
        </div>
        <div className="o2-plans">
          {L.plans.map(p => (
            <div key={p.key} className={`o2-plan${p.key === 'biznes' ? ' pop' : ''}`}>
              <div className="o2-plan-h"><b>{p.name}</b>{p.price != null && p.price > 0 && <span className="o2-tag mute">{t.common.demoChip}</span>}</div>
              <div className="o2-plan-p">{p.price == null ? <strong>{L.priceAsk}</strong> : <><strong>{num(Math.round(p.price * (yearly ? 0.8 : 1)))}</strong><small>{t.common.perMonth}</small></>}</div>
              <ul>{p.f.map(f => <li key={f}><Check size={14} /> {f}</li>)}</ul>
              {p.price === null ? <a className="o2-btn ghost" href="#/signup">{t.billing.contact}</a> : <a className={`o2-btn ${p.key === 'biznes' ? 'primary' : 'ghost'}`} href="#/signup">{L.choose}</a>}
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="o2-sec o2-faq-wrap">
        <h2 className="o2-center">{L.faqTitle}</h2>
        <Faq />
      </section>

      <section className="o2-final">
        <h2>{L.finalTitle}</h2>
        <p>{L.finalText}</p>
        <DemoButton big />
      </section>

      <footer className="o2-foot"><Logo /><span>{L.footer}</span><span className="o2-mono">v0.1</span></footer>
    </div>
  )
}

function VisInbox() {
  const rows = [
    { k: 'telegram', n: 'Dilnoza R.', m: 'Narxlar qancha?', u: 2, ai: true },
    { k: 'whatsapp', n: 'Nodira K.', m: 'Shartnoma bo‘yicha…', u: 1, ai: false },
    { k: 'instagram', n: 'Jasur T.', m: 'Rahmat, kelaman', u: 0, ai: true },
    { k: 'sms', n: '+998 00 *** 41', m: 'Ertaga bo‘ladimi?', u: 0, ai: true },
    { k: 'widget', n: 'Sayt mehmoni', m: 'Yetkazib berish bormi?', u: 3, ai: true },
  ]
  return (
    <div className="o2-vis">
      {rows.map(r => (
        <div key={r.n} className="o2-vis-row"><ChBadge kind={r.k} /><b>{r.n}</b><span>{r.m}</span>{r.ai && <em className="o2-tag acc">AI</em>}{r.u > 0 && <i className="o2-badge">{r.u}</i>}</div>
      ))}
    </div>
  )
}
function VisBoard() {
  const cols = [{ n: 'Yangi', c: '#64748b', k: 4 }, { n: 'Qiziqdi', c: '#d97706', k: 6 }, { n: 'Uchrashuv', c: '#7c3aed', k: 3 }, { n: 'Yutildi', c: '#059669', k: 9 }]
  return (
    <div className="o2-vis o2-vis-board">
      {cols.map(c => (
        <div key={c.n}><small style={{ color: c.c }}>● {c.n} <b>{c.k}</b></small>{Array.from({ length: Math.min(3, c.k) }, (_, i) => <span key={i} style={{ opacity: 1 - i * 0.25 }} />)}</div>
      ))}
    </div>
  )
}
function VisAgent() {
  return (
    <div className="o2-vis o2-vis-agent">
      <div className="in">Yetkazib berish bormi?</div>
      <div className="ai"><Bot size={12} /> Ha, Toshkent bo‘ylab bepul. Manzilingizni yozing, bugun olib boramiz.</div>
      <div className="in">Operator bilan gaplashmoqchiman</div>
      <div className="sys">Kalit so‘z: «operator» → suhbat Mohira'ga uzatildi</div>
    </div>
  )
}
