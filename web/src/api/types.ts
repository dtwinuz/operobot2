// Types mirror docs/04-api.md (v0.1) exactly.
export type Role = 'owner' | 'admin' | 'operator'
export type PlanKey = 'start' | 'biznes' | 'pro' | 'korporativ'

export type Me = {
  user: { id: string; name: string; email: string }
  org: { id: string; name: string; plan: PlanKey; demo: boolean }
  role: Role
  orgs: { id: string; name: string; role: Role }[]
}

export type Stage = { id: string; key: string; name: string; color: string; position: number; kind: 'open' | 'won' | 'lost' }
export type Interest = 'yuqori' | "o'rta" | 'past'

export type ChannelKind = 'telegram' | 'whatsapp' | 'instagram' | 'sms' | 'widget'

export type Lead = {
  id: string; title: string; value: number | null; stageId: string; interest: Interest | null
  nextAction: string | null; dueAt: string | null; assigneeId: string | null; assigneeName: string | null
  source: ChannelKind | 'manual' | 'call'; summary: string | null; conversationId: string | null
  contact: { id: string; name: string; phone: string | null }; createdAt: string; updatedAt: string
}

export type Contact = {
  id: string; name: string; phone: string | null; username: string | null; channel: ChannelKind | 'manual'
  tags: string[]; createdAt: string; lastSeenAt: string | null; leads: number; doNotCallAt: string | null
}

export type Conversation = {
  id: string; channel: ChannelKind; channelName: string; status: 'open' | 'closed'; mode: 'ai' | 'human'
  assigneeId: string | null; assigneeName: string | null; unread: number; leadId: string | null
  contact: { id: string; name: string; phone: string | null; username: string | null }
  last: { text: string; at: string; direction: 'in' | 'out' } | null
}

export type Message = {
  id: string; direction: 'in' | 'out'; author: 'contact' | 'ai' | 'user' | 'system'; userName: string | null
  text: string; at: string; status: 'sent' | 'failed' | 'demo' | 'received'
}

export type Channel = {
  id: string; kind: ChannelKind; name: string; status: 'connected' | 'demo' | 'error'; info: string | null
  webhookUrl: string | null; widgetKey: string | null; createdAt: string
}

export type Agent = {
  id: string; name: string; kind: 'chat' | 'voice'; enabled: boolean; prompt: string; greeting: string
  handoff: string[]; channelIds: string[]; voice: string | null; stats: { replies: number; handoffs: number }
}

export type AgentTest = {
  reply: string; action: 'reply' | 'handoff' | 'close'
  extracted: { name?: string; phone?: string; interest?: Interest; meeting?: string }
}

export type Campaign = {
  id: string; name: string; status: 'draft' | 'running' | 'paused' | 'done'; agentId: string | null
  total: number; called: number; answered: number; connected: number; createdAt: string; skipped?: number
}

export type CallStatus = 'queued' | 'dialing' | 'answered' | 'connected' | 'no_answer' | 'busy' | 'failed' | 'declined' | 'blocked' | 'operator_busy'
export type Call = {
  id: string; campaignId: string | null; direction: 'out' | 'in'; status: CallStatus; durationSec: number
  startedAt: string | null; summary: string | null; contact: { id: string; name: string; phone: string | null }
}

export type ContactDetail = Contact & { conversations: Conversation[]; calls: Call[]; leads: Lead[] }

export type Member = { userId: string; name: string; email: string; role: Role; lastSeenAt: string | null }

export type Limits = { operators: number; channels: number; messages: number; aiReplies: number; callMinutes: number }
export type Plan = { key: PlanKey; name: string; priceMonth: number | null; limits: Limits; features: string[] }
export type Invoice = { id: string; plan: PlanKey; months: number; amount: number; provider: string; status: 'pending' | 'paid' | 'failed'; createdAt: string }
export type Billing = { plan: Plan; periodStart: string; periodEnd: string; usage: Limits; plans: Plan[]; invoices: Invoice[] }

export type Settings = { name: string; timezone: string; workFrom: number; workTo: number; apiKeyPrefix?: string | null; apiKeyAt?: string | null }

export type Stats = {
  today: { inbound: number; outbound: number; aiReplies: number; firstReplySec: number | null; calls: number; connected: number; newLeads: number; won: number }
  byChannel: { kind: string; count: number }[]
  hourly: { h: number; inbound: number; calls: number }[]
  funnel: { stageId: string; name: string; color: string; count: number }[]
}

export type ServerEvent =
  | { type: 'message'; data: { conversationId: string; message: Message } }
  | { type: 'conversation'; data: Conversation }
  | { type: 'lead'; data: Lead }
  | { type: 'call'; data: Call }
  | { type: 'campaign'; data: Campaign }
  | { type: 'usage'; data: Limits }
