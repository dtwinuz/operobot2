// In-memory /api for the static demo: same routes and shapes as api/src/routes (docs/04-api.md),
// plus a small simulator that keeps the inbox, board and call log moving while someone watches.
import type { Agent, AgentTest, Billing, Call, CallStatus, Campaign, Channel, ContactDetail, Conversation, Interest, Invoice, Lead, Me, Member, Message, PlanKey, ServerEvent, Settings, Stats } from '../api/types'
import { AGENTS, CALLS, CAMPAIGNS, CHANNELS, CONTACTS, CONVS, INVOICES, LEADS, ME_ID, MEMBERS, MESSAGES, NAMES, PLANS, STAGES, USAGE, ago, id, phone, stageId } from './data'

const iso = () => new Date().toISOString()
const clone = <T>(x: T): T => structuredClone(x)
/** Random lowercase token for the fake temp password and API key the demo shows (never used for auth). */
const rnd = (len: number) => Array.from(crypto.getRandomValues(new Uint8Array(len)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')

/* ---------- session ---------- */
let signedIn = true
const ORGS = [{ id: 'org_namuna', name: 'Namuna Servis', role: 'owner' as const }, { id: 'org_market', name: 'Namuna Market', role: 'admin' as const }]
let orgId = 'org_namuna'
let planKey: PlanKey = 'pro'
const settings: Settings = { name: 'Namuna Servis', timezone: 'Asia/Tashkent', workFrom: 9, workTo: 18, apiKeyPrefix: 'ob2_7f3a', apiKeyAt: ago(60 * 24 * 12) }
const me = (): Me => {
  const org = ORGS.find(o => o.id === orgId)!
  return {
    user: { id: ME_ID, name: 'Aziza Rahimova', email: 'aziza@namuna.uz' },
    org: { id: org.id, name: org.id === 'org_namuna' ? settings.name : org.name, plan: planKey, demo: true }, role: org.role,
    orgs: ORGS.map(o => ({ ...o, name: o.id === 'org_namuna' ? settings.name : o.name })),
  }
}

/* ---------- events (fake EventSource) ---------- */
type Sub = (e: ServerEvent) => void
const subs = new Set<Sub>()
const emit = (e: ServerEvent) => { for (const s of subs) s(clone(e)) }

export class DemoEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  readyState = 1
  url: string
  withCredentials = true
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  onopen: ((ev: Event) => void) | null = null
  private sub: Sub = e => this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(e) }))
  constructor(url: string) { this.url = url; subs.add(this.sub); startSim() }
  close() { this.readyState = 2; subs.delete(this.sub) }
  addEventListener() { /* the app uses onmessage only */ }
  removeEventListener() { /* noop */ }
}

/* ---------- rule-based AI (same replies as api/src/ai/brain.ts without LLM) ---------- */
const norm = (s: string) => s.toLowerCase().replace(/[ʻʼ‘’`´]/g, "'")
type Decision = AgentTest & { stage?: string; summary?: string }
function decide(agent: Pick<Agent, 'greeting' | 'handoff'>, text: string, first: boolean): Decision {
  const t = norm(text)
  const ph = /(\+?998[\s-]?)?\(?(\d{2})\)?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})\b/.exec(text)
  const ex: AgentTest['extracted'] = ph ? { phone: `+998 ${ph[2]} ${ph[3]} ${ph[4]} ${ph[5]}` } : {}
  const nm = /(?:ismim|men)\s+([A-Z][a-z']{2,})/.exec(text)
  if (nm) ex.name = nm[1]
  const meet = /\b(bugun|ertaga|dushanba|seshanba|chorshanba|payshanba|juma|shanba|yakshanba)\b/.exec(t)
  const hour = /\b(\d{1,2})[:.](\d{2})\b/.exec(t) ?? /soat\s+(\d{1,2})\b/.exec(t)
  const handoff = agent.handoff.length ? agent.handoff : ['operator', 'odam bilan', 'menejer']
  if (handoff.some(k => t.includes(norm(k)))) return { reply: 'Albatta, sizni operatorga ulayman. Bir daqiqa kuting.', action: 'handoff', extracted: { ...ex, interest: 'yuqori' }, summary: 'Mijoz operator bilan gaplashmoqchi.' }
  if (/kerak emas|qiziq emas|yo'q,? rahmat|bezovta qilmang|qimmat ekan/.test(t)) return { reply: "Tushundim, rahmat! Kerak bo'lsa shu yerga yozing, doim yordam beramiz.", action: 'close', extracted: { ...ex, interest: 'past' }, stage: 'yutqazildi', summary: 'Mijoz hozircha rad etdi.' }
  if (meet) {
    const when = `${meet[1]} ${hour ? `${hour[1]!.padStart(2, '0')}:${hour[2] && hour[2].length === 2 ? hour[2] : '00'}` : '10:00'}`
    return { reply: `Ajoyib! ${when} ga yozib qo'ydim. Bir kun oldin eslatma yuboramiz.`, action: 'reply', extracted: { ...ex, interest: 'yuqori', meeting: when }, stage: 'uchrashuv', summary: `Mijoz ${when} ga kelishdi.` }
  }
  if (ex.phone) return { reply: "Rahmat! Menejerimiz shu raqamga tez orada qo'ng'iroq qiladi. Qulay vaqtni ham yozib qoldirsangiz bo'ladi.", action: 'reply', extracted: { ...ex, interest: 'yuqori' }, stage: 'qiziqdi', summary: "Mijoz raqamini qoldirdi, qo'ng'iroq kutyapti." }
  if (/keyinroq|hozir band|vaqtim yo'q/.test(t)) return { reply: 'Mayli, qachon qulay? Kun va soatni yozing, o‘sha paytda bog‘lanamiz.', action: 'reply', extracted: { ...ex, interest: "o'rta" }, stage: 'qayta', summary: "Mijoz keyinroq gaplashishni so'radi." }
  if (/narx|qancha|necha pul|to'lov|chegirma/.test(t)) return { reply: "Narx xizmat turiga va hajmga bog'liq. Qaysi xizmat kerakligini va telefon raqamingizni yozsangiz, aniq hisob-kitobni yuboramiz.", action: 'reply', extracted: { ...ex, interest: "o'rta" }, stage: 'qiziqdi', summary: 'Mijoz narx bilan qiziqdi.' }
  if (/manzil|qayerda|filial|ish vaqt/.test(t)) return { reply: 'Biz har kuni 09:00–18:00 ishlaymiz. Uchrashuv uchun qulay kun va soatni yozing, manzilni yuboramiz.', action: 'reply', extracted: { ...ex, interest: "o'rta" } }
  if (first || /assalom|salom|hayrli/.test(t)) return { reply: agent.greeting || 'Assalomu alaykum! Qanday yordam bera olaman?', action: 'reply', extracted: ex }
  return { reply: "Tushundim. Batafsilroq yozsangiz yoki telefon raqamingizni qoldirsangiz, mutaxassisimiz bog'lanadi.", action: 'reply', extracted: ex }
}

/* ---------- helpers ---------- */
const opName = (uid: string | null) => MEMBERS.find(m => m.userId === uid)?.name ?? null
function touch(conv: Conversation, m: Message) {
  conv.last = { text: m.text, at: m.at, direction: m.direction }
  emit({ type: 'message', data: { conversationId: conv.id, message: m } })
}
function push(conv: Conversation, m: Omit<Message, 'id' | 'at'>): Message {
  const msg: Message = { ...m, id: id('m'), at: iso() }
  MESSAGES.get(conv.id)!.push(msg)
  touch(conv, msg)
  return msg
}
function leadFromAi(conv: Conversation, d: Decision) {
  if (!d.stage && !d.extracted.phone) return
  let lead = LEADS.find(l => l.id === conv.leadId)
  const c = CONTACTS.find(x => x.id === conv.contact.id)
  if (!lead) {
    lead = { id: id('ld'), title: `${conv.contact.name.split(' ')[0]} · ${conv.channel}`, value: null, stageId: stageId('yangi'), interest: null, nextAction: null, dueAt: null, assigneeId: null, assigneeName: null, source: conv.channel, summary: null, conversationId: conv.id, contact: { id: conv.contact.id, name: conv.contact.name, phone: conv.contact.phone }, createdAt: iso(), updatedAt: iso() }
    LEADS.unshift(lead); conv.leadId = lead.id
    if (c) c.leads++
    emit({ type: 'conversation', data: conv })
  }
  if (d.stage) lead.stageId = stageId(d.stage)
  if (d.extracted.interest) lead.interest = d.extracted.interest as Interest
  if (d.summary) lead.summary = `${d.summary} (AI Zarina)`
  if (d.extracted.phone) { lead.contact.phone = d.extracted.phone; conv.contact.phone = d.extracted.phone; if (c) c.phone = d.extracted.phone }
  lead.updatedAt = iso()
  emit({ type: 'lead', data: lead })
}
function aiAnswer(conv: Conversation, delay = 1400) {
  if (conv.mode !== 'ai') return
  setTimeout(() => {
    const msgs = MESSAGES.get(conv.id)!
    const last = [...msgs].reverse().find(m => m.author === 'contact')
    const agent = AGENTS.find(a => a.kind === 'chat' && a.enabled && a.channelIds.some(cid => CHANNELS.find(c => c.id === cid)?.kind === conv.channel)) ?? AGENTS[0]!
    const d = decide(agent, last?.text ?? '', msgs.filter(m => m.author === 'ai').length === 0)
    push(conv, { direction: 'out', author: 'ai', userName: null, text: d.reply, status: 'sent' })
    agent.stats.replies++
    USAGE.aiReplies++; USAGE.messages++
    if (d.action === 'handoff') {
      agent.stats.handoffs++
      conv.mode = 'human'
      push(conv, { direction: 'out', author: 'system', userName: null, text: `${agent.name} suhbatni operatorga topshirdi.`, status: 'sent' })
      emit({ type: 'conversation', data: conv })
    }
    leadFromAi(conv, d)
    emit({ type: 'usage', data: { ...USAGE } })
  }, delay)
}

/* ---------- simulator ---------- */
let simOn = false
let seq = 0
const OPENERS = ['Assalomu alaykum, narxlar qancha?', 'Salom, xizmatlaringiz haqida ma’lumot bering', 'Yetkazib berish bormi?', 'Bugun ishlaysizmi?', 'Chegirma bormi hozir?', 'Qayerda joylashgansiz?']
const FOLLOW = ['+998 00 {p}', 'ertaga soat 15 da qulay', 'operator bilan gaplashsam bo‘ladimi', 'keyinroq yozaman, hozir bandman', '2 ta xonaga kerak, qancha bo‘ladi?']
function startSim() {
  if (simOn) return
  simOn = true
  setInterval(chatTick, 14_000)
  setInterval(callTick, 4_000)
}
function chatTick() {
  seq++
  const open = CONVS.filter(c => c.mode === 'ai' && c.status === 'open' && c.last?.direction === 'out' && (MESSAGES.get(c.id)?.filter(m => m.direction === 'in').length ?? 9) < 4)
  if (open.length && seq % 2) {
    const conv = open[seq % open.length]!
    const text = FOLLOW[seq % FOLLOW.length]!.replace('{p}', `${100 + (seq * 41) % 900} ${10 + seq % 90} ${20 + seq % 70}`)
    conv.unread++
    push(conv, { direction: 'in', author: 'contact', userName: null, text, status: 'received' })
    aiAnswer(conv)
    return
  }
  const kinds = ['telegram', 'instagram', 'whatsapp', 'widget'] as const
  const kind = kinds[seq % kinds.length]!
  const name = NAMES[(seq * 5 + 11) % NAMES.length]!
  const ch = CHANNELS.find(c => c.kind === kind)!
  const contact = { id: id('ct'), name, phone: kind === 'whatsapp' ? phone(300 + seq) : null, username: kind === 'telegram' || kind === 'instagram' ? `${name.split(' ')[0]!.toLowerCase().replace(/[^a-z]/g, '')}${seq}` : null }
  CONTACTS.unshift({ ...contact, channel: kind, tags: [], createdAt: iso(), lastSeenAt: iso(), leads: 0, doNotCallAt: null })
  const conv: Conversation = { id: id('cv'), channel: kind, channelName: ch.name, status: 'open', mode: 'ai', assigneeId: null, assigneeName: null, unread: 1, leadId: null, contact, last: null }
  MESSAGES.set(conv.id, [])
  CONVS.unshift(conv)
  const first: Message = { id: id('m'), direction: 'in', author: 'contact', userName: null, text: OPENERS[seq % OPENERS.length]!, at: iso(), status: 'received' }
  MESSAGES.get(conv.id)!.push(first)
  conv.last = { text: first.text, at: first.at, direction: 'in' }
  emit({ type: 'conversation', data: conv })
  aiAnswer(conv, 1800)
}
const NEXT: Partial<Record<CallStatus, CallStatus[]>> = { queued: ['dialing'], dialing: ['answered', 'no_answer', 'busy', 'answered', 'no_answer'], answered: ['connected', 'declined', 'answered', 'connected', 'operator_busy'] }
function callTick() {
  for (const cp of CAMPAIGNS.filter(c => c.status === 'running')) {
    const live = CALLS.find(c => c.campaignId === cp.id && (c.status === 'dialing' || (c.status === 'answered' && !c.summary)))
    if (live) {
      const opts = NEXT[live.status]!
      const st = opts[(seq++ + live.id.length) % opts.length]!
      if (live.status === 'answered' && st === 'answered') live.summary = 'Agent bilan gaplashdi, keyinroq qaror qiladi.'
      if (st !== live.status) {
        live.status = st
        if (st === 'answered') { cp.answered++; live.durationSec = 6 }
        if (st === 'connected') { cp.connected++; live.durationSec = 64 + (seq * 13) % 180; live.summary = 'Mijoz 1 ni bosdi, operator bilan gaplashdi.' }
        if (st === 'declined') { live.durationSec = 14; live.summary = 'Mijoz 2 ni bosdi: qiziqmaydi.' }
        if (st === 'operator_busy') { live.durationSec = 11; live.summary = '1 ni bosdi, operatorlar band edi: qayta qo‘ng‘iroq rejalandi.' }
        USAGE.callMinutes += Math.ceil(live.durationSec / 60)
      }
      emit({ type: 'call', data: live }); emit({ type: 'campaign', data: cp })
      continue
    }
    if (cp.called >= cp.total) { cp.status = 'done'; emit({ type: 'campaign', data: cp }); continue }
    let q = CALLS.find(c => c.campaignId === cp.id && c.status === 'queued')
    if (!q) {
      const i = (cp.called * 7 + 3) % NAMES.length
      q = { id: id('cl'), campaignId: cp.id, direction: 'out', status: 'queued', durationSec: 0, startedAt: null, summary: null, contact: { id: `ct_q_${i}`, name: NAMES[i]!, phone: phone(500 + cp.called) } }
    } else CALLS.splice(CALLS.indexOf(q), 1)
    q.status = 'dialing'; q.startedAt = iso(); cp.called++
    CALLS.unshift(q)
    emit({ type: 'call', data: q }); emit({ type: 'campaign', data: cp })
  }
}

/* ---------- routes ---------- */
class HttpError extends Error { status: number; constructor(status: number, m: string) { super(m); this.status = status } }
const need = <T>(x: T | undefined, what = 'topilmadi'): T => { if (x === undefined) throw new HttpError(404, what); return x }

function stats(): Stats {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isToday = (s: string | null) => !!s && Date.parse(s) >= today.getTime()
  const msgs = [...MESSAGES.values()].flat()
  const hourNow = new Date().getHours()
  const curve = [0, 0, 0, 0, 0, 0, 0, 1, 4, 11, 18, 22, 17, 14, 19, 23, 21, 16, 9, 6, 4, 2, 1, 0]
  const hourly = curve.map((v, h) => ({ h, inbound: h <= hourNow || hourNow < 9 ? v * 3 + (h * 7) % 5 : 0, calls: h >= 9 && h < 18 && (h <= hourNow || hourNow < 9) ? v * 2 + (h * 3) % 7 : 0 }))
  const byKind = new Map<string, number>()
  for (const c of CONVS) byKind.set(c.channel, (byKind.get(c.channel) ?? 0) + (MESSAGES.get(c.id)?.length ?? 0) * 9)
  byKind.set('call', CALLS.length * 3)
  const won = LEADS.filter(l => STAGES.find(s => s.id === l.stageId)?.kind === 'won').length
  return {
    today: {
      inbound: 312 + msgs.filter(m => m.direction === 'in' && isToday(m.at)).length, outbound: 268 + msgs.filter(m => m.direction === 'out' && isToday(m.at)).length,
      aiReplies: 201 + msgs.filter(m => m.author === 'ai' && isToday(m.at)).length, firstReplySec: 7,
      calls: CALLS.filter(c => isToday(c.startedAt)).length + 140, connected: CALLS.filter(c => c.status === 'connected' && isToday(c.startedAt)).length + 31,
      newLeads: LEADS.filter(l => isToday(l.createdAt)).length + 9, won: won,
    },
    byChannel: [...byKind.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
    hourly,
    funnel: STAGES.map(s => ({ stageId: s.id, name: s.name, color: s.color, count: LEADS.filter(l => l.stageId === s.id).length })),
  }
}

function billing(): Billing {
  const p = PLANS.find(x => x.key === planKey)!
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setMonth(end.getMonth() + 1)
  return { plan: p, periodStart: start.toISOString(), periodEnd: end.toISOString(), usage: { ...USAGE }, plans: PLANS, invoices: INVOICES }
}

function contactDetail(cid: string): ContactDetail {
  const c = need(CONTACTS.find(x => x.id === cid), 'kontakt topilmadi')
  let calls = CALLS.filter(x => x.contact.id === cid)
  if (!calls.length && c.phone) {
    const k = CONTACTS.indexOf(c)
    const st: CallStatus[] = ['connected', 'no_answer', 'answered']
    calls = Array.from({ length: 1 + (k % 3) }, (_, j) => ({ id: `cl_${cid}_${j}`, campaignId: 'cp_okt', direction: 'out' as const, status: st[(k + j) % 3]!, durationSec: st[(k + j) % 3] === 'connected' ? 95 + j * 20 : st[(k + j) % 3] === 'answered' ? 12 : 0, startedAt: ago(60 * 24 * (3 + j * 5) + k), summary: null, contact: { id: cid, name: c.name, phone: c.phone } }))
  }
  return { ...c, conversations: CONVS.filter(x => x.contact.id === cid), calls, leads: LEADS.filter(l => l.contact.id === cid) as Lead[] & number } as ContactDetail
}

type Body = Record<string, unknown>
async function route(method: string, path: string, q: URLSearchParams, body: Body): Promise<unknown> {
  const seg = path.split('/').filter(Boolean)
  const [a, b, c] = seg
  if (a === 'auth') {
    if (b === 'logout') { signedIn = false; return { ok: true } }
    if (b === 'login' && (String(body.password ?? '') === '' || !String(body.email ?? '').includes('@'))) throw new HttpError(401, "Email yoki parol noto'g'ri")
    signedIn = true
    if (b === 'signup' && body.company) settings.name = String(body.company)
    return me()
  }
  if (!signedIn) throw new HttpError(401, 'Kirish kerak')
  switch (`${method} ${a}${b ? '/:b' : ''}${c ? '/:c' : ''}`) {
    case 'GET me': return me()
    case 'POST orgs/:b': orgId = String(body.orgId ?? orgId); return me()
    case 'GET stats': return stats()
    case 'GET stages': return STAGES
    case 'GET conversations': {
      const f = q.get('filter') ?? 'all'
      const s = norm(q.get('q') ?? '')
      return CONVS.filter(x => (f === 'unread' ? x.unread > 0 : f === 'mine' ? x.assigneeId === ME_ID : f === 'ai' ? x.mode === 'ai' : true))
        .filter(x => !s || norm(`${x.contact.name} ${x.contact.phone ?? ''} ${x.contact.username ?? ''} ${x.last?.text ?? ''}`).includes(s))
    }
    case 'GET conversations/:b/:c': {
      const conv = need(CONVS.find(x => x.id === b))
      conv.unread = 0
      return MESSAGES.get(conv.id) ?? []
    }
    case 'POST conversations/:b/:c': {
      const conv = need(CONVS.find(x => x.id === b))
      if (c === 'suggest') {
        const last = [...(MESSAGES.get(conv.id) ?? [])].reverse().find(m => m.author === 'contact')
        return { text: decide(AGENTS[0]!, last?.text ?? '', false).reply }
      }
      const m = push(conv, { direction: 'out', author: 'user', userName: opName(ME_ID), text: String(body.text ?? ''), status: 'demo' })
      conv.mode = 'human'; conv.assigneeId = ME_ID; conv.assigneeName = opName(ME_ID); conv.status = 'open'
      USAGE.messages++
      setTimeout(() => { conv.unread++; push(conv, { direction: 'in', author: 'contact', userName: null, text: 'Rahmat, tushundim 👍', status: 'received' }) }, 4500)
      return m
    }
    case 'PATCH conversations/:b': {
      const conv = need(CONVS.find(x => x.id === b))
      if (body.mode === 'ai' || body.mode === 'human') conv.mode = body.mode
      if (body.status === 'open' || body.status === 'closed') conv.status = body.status
      if ('assigneeId' in body) { conv.assigneeId = (body.assigneeId as string) ?? null; conv.assigneeName = opName(conv.assigneeId) }
      if (body.mode === 'human' && !conv.assigneeId) { conv.assigneeId = ME_ID; conv.assigneeName = opName(ME_ID) }
      return conv
    }
    case 'GET leads': return LEADS
    case 'POST leads': {
      const ct = { id: id('ct'), name: String(body.name), phone: (body.phone as string) ?? null }
      CONTACTS.unshift({ ...ct, username: null, channel: 'manual', tags: [], createdAt: iso(), lastSeenAt: null, leads: 1, doNotCallAt: null })
      const l: Lead = { id: id('ld'), title: String(body.title), value: (body.value as number) ?? null, stageId: STAGES[0]!.id, interest: null, nextAction: null, dueAt: null, assigneeId: ME_ID, assigneeName: opName(ME_ID), source: 'manual', summary: null, conversationId: null, contact: ct, createdAt: iso(), updatedAt: iso() }
      LEADS.unshift(l)
      return l
    }
    case 'PATCH leads/:b': {
      const l = need(LEADS.find(x => x.id === b))
      if (typeof body.stageId === 'string' && STAGES.some(s => s.id === body.stageId)) l.stageId = body.stageId
      l.updatedAt = iso()
      return l
    }
    case 'GET contacts': {
      const s = norm(q.get('q') ?? '')
      return CONTACTS.filter(x => !s || norm(`${x.name} ${x.phone ?? ''} ${x.username ?? ''} ${x.tags.join(' ')}`).includes(s))
    }
    case 'GET contacts/:b': return contactDetail(b!)
    case 'PATCH contacts/:b': {
      const ct = need(CONTACTS.find(x => x.id === b))
      ct.doNotCallAt = body.doNotCall ? iso() : null
      return { doNotCallAt: ct.doNotCallAt }
    }
    case 'GET campaigns': return CAMPAIGNS
    case 'POST campaigns': {
      const phones = (body.phones as string[]) ?? []
      if (!body.consent) throw new HttpError(400, 'Rozilik belgilanmagan')
      const valid = phones.filter(p => p.replace(/\D/g, '').length >= 9)
      const blocked = CONTACTS.filter(x => x.doNotCallAt && x.phone && valid.includes(x.phone)).length
      const cp: Campaign = { id: id('cp'), name: String(body.name), status: 'draft', agentId: (body.agentId as string) ?? null, total: valid.length - blocked, called: 0, answered: 0, connected: 0, createdAt: iso(), skipped: phones.length - valid.length + blocked }
      CAMPAIGNS.unshift(cp)
      valid.forEach((p, k) => CALLS.push({ id: id('cl'), campaignId: cp.id, direction: 'out', status: 'queued', durationSec: 0, startedAt: null, summary: null, contact: { id: id('ct'), name: `Mijoz ${k + 1}`, phone: p } }))
      return cp
    }
    case 'POST campaigns/:b/:c': {
      const cp = need(CAMPAIGNS.find(x => x.id === b))
      if (c === 'start') { if (!cp.total) throw new HttpError(400, "Kampaniyada raqam yo'q"); cp.status = 'running'; startSim() }
      if (c === 'pause') cp.status = 'paused'
      return cp
    }
    case 'GET calls': return CALLS.slice(0, Number(q.get('limit') ?? 100))
    case 'GET agents': return AGENTS
    case 'POST agents': {
      const ag: Agent = { ...(body as unknown as Agent), id: id('ag'), stats: { replies: 0, handoffs: 0 } }
      AGENTS.push(ag)
      return ag
    }
    case 'PATCH agents/:b': {
      const ag = need(AGENTS.find(x => x.id === b))
      Object.assign(ag, body, { id: ag.id, stats: ag.stats })
      return ag
    }
    case 'POST agents/:b/:c': {
      const ag = need(AGENTS.find(x => x.id === b))
      const d = decide(ag, String(body.text ?? ''), false)
      return { reply: d.reply, action: d.action, extracted: d.extracted } satisfies AgentTest
    }
    case 'GET channels': return CHANNELS
    case 'POST channels': {
      const kind = body.kind as Channel['kind']
      const cid = id('ch')
      const ch: Channel = { id: cid, kind, name: String(body.name), status: 'demo', info: 'Demo kanal: xabarlar tashqariga chiqmaydi', webhookUrl: kind === 'widget' ? null : `https://operobot2.dtwin.uz/api/hooks/${kind}/${cid}`, widgetKey: kind === 'widget' ? `wk_${cid.slice(3)}demo` : null, createdAt: iso() }
      CHANNELS.push(ch); USAGE.channels = CHANNELS.length
      return ch
    }
    case 'DELETE channels/:b': {
      const i = CHANNELS.findIndex(x => x.id === b)
      if (i >= 0) CHANNELS.splice(i, 1)
      USAGE.channels = CHANNELS.length
      return { ok: true }
    }
    case 'GET members': return MEMBERS
    case 'POST members': {
      if (MEMBERS.some(m => m.email === body.email)) throw new HttpError(409, "Bu email allaqachon jamoada")
      const m: Member = { userId: id('u'), name: String(body.name), email: String(body.email), role: body.role === 'admin' ? 'admin' : 'operator', lastSeenAt: null }
      MEMBERS.push(m); USAGE.operators = MEMBERS.length - 1
      return { member: m, tempPassword: `Demo-${rnd(6)}` }
    }
    case 'PATCH members/:b': { const m = need(MEMBERS.find(x => x.userId === b)); if (body.role === 'admin' || body.role === 'operator') m.role = body.role; return m }
    case 'DELETE members/:b': { const i = MEMBERS.findIndex(x => x.userId === b); if (i > 0) MEMBERS.splice(i, 1); USAGE.operators = MEMBERS.length - 1; return { ok: true } }
    case 'GET billing': return billing()
    case 'POST billing/:b': {
      const p = need(PLANS.find(x => x.key === body.plan), 'tarif topilmadi')
      const months = Number(body.months ?? 1)
      const inv: Invoice = { id: id('inv'), plan: p.key, months, amount: (p.priceMonth ?? 0) * months * (months >= 12 ? 0.8 : 1), provider: String(body.provider ?? 'payme'), status: 'paid', createdAt: iso() }
      INVOICES.unshift(inv); planKey = p.key
      return { invoice: inv, payUrl: null }
    }
    case 'GET settings': return settings
    case 'PATCH settings': Object.assign(settings, body); return settings
    case 'POST settings/:b': { const key = `ob2_${rnd(4)}_${rnd(12)}demo`; settings.apiKeyPrefix = key.slice(0, 8); settings.apiKeyAt = iso(); return { key } }
  }
  throw new HttpError(404, `demo: ${method} ${path} yo'q`)
}

/** window.fetch wrapper: /api/* is answered from memory, everything else goes to the network. */
export function installFetch() {
  const real = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const u = new URL(url, location.origin)
    if (u.origin !== location.origin || !u.pathname.startsWith('/api/')) return real(input, init)
    await new Promise(r => setTimeout(r, 90 + Math.random() * 180))
    const method = (init?.method ?? 'GET').toUpperCase()
    let body: Body = {}
    try { body = init?.body ? JSON.parse(String(init.body)) : {} } catch { /* not json */ }
    try {
      const data = await route(method, u.pathname.slice(4), u.searchParams, body)
      return new Response(JSON.stringify(clone(data)), { status: 200, headers: { 'content-type': 'application/json' } })
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500
      return new Response(JSON.stringify({ error: (e as Error).message }), { status, headers: { 'content-type': 'application/json' } })
    }
  }
}

export type { Call }
