// Row → API shape (docs/04-api.md). Keep the selects here so every route returns identical objects.
import type { Q } from "./db.js";

export const LEAD_SELECT = `
  select l.id, l.title, l.value, l.stage_id "stageId", l.interest, l.next_action "nextAction", l.due_at "dueAt",
    l.assignee_id "assigneeId", u.name "assigneeName", l.source, l.summary, l.conversation_id "conversationId",
    json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) contact, l.created_at "createdAt", l.updated_at "updatedAt"
  from leads l join contacts c on c.id = l.contact_id left join users u on u.id = l.assignee_id`;

export const CONV_SELECT = `
  select v.id, ch.kind channel, ch.name "channelName", v.status, v.mode, v.assignee_id "assigneeId", u.name "assigneeName",
    v.unread, v.lead_id "leadId",
    json_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'username', c.username) contact,
    case when v.last_at is null then null else json_build_object('text', v.last_text, 'at', v.last_at, 'direction', v.last_dir) end last
  from conversations v join contacts c on c.id = v.contact_id join channels ch on ch.id = v.channel_id
  left join users u on u.id = v.assignee_id`;

export const MSG_SELECT = `
  select m.id, m.direction, m.author, u.name "userName", m.text, m.at, m.status
  from messages m left join users u on u.id = m.user_id`;

export const CALL_SELECT = `
  select k.id, k.campaign_id "campaignId", k.direction, k.status, k.duration_sec "durationSec", k.started_at "startedAt", k.summary,
    json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) contact
  from calls k join contacts c on c.id = k.contact_id`;

export const CAMPAIGN_SELECT = `
  select p.id, p.name, p.status, p.agent_id "agentId", p.created_at "createdAt",
    count(k.id)::int total,
    count(k.id) filter (where k.status <> 'queued' and k.status <> 'dialing')::int called,
    count(k.id) filter (where k.status in ('answered', 'connected', 'declined'))::int answered,
    count(k.id) filter (where k.status = 'connected')::int connected
  from campaigns p left join calls k on k.campaign_id = p.id`;

export const AGENT_SELECT = `
  select id, name, kind, enabled, prompt, greeting, handoff, channel_ids "channelIds", voice,
    json_build_object('replies', replies, 'handoffs', handoffs) stats from agents`;

export type Lead = { id: string; stageId: string; contact: { id: string; name: string; phone: string | null }; conversationId: string | null } & Record<string, unknown>;
export type Conversation = { id: string; channel: string; mode: "ai" | "human"; status: string; leadId: string | null; contact: { id: string; name: string } } & Record<string, unknown>;

export const getLead = (q: Q, id: string) => q.one<Lead>(`${LEAD_SELECT} where l.id = $1`, [id]);
export const getConv = (q: Q, id: string) => q.one<Conversation>(`${CONV_SELECT} where v.id = $1`, [id]);
export const getCall = (q: Q, id: string) => q.one(`${CALL_SELECT} where k.id = $1`, [id]);
export const getCampaign = (q: Q, id: string) => q.one(`${CAMPAIGN_SELECT} where p.id = $1 group by p.id`, [id]);
