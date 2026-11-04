-- operobot2 schema v0.1 (docs/03-malumot-modeli.md, ADR-0002).
-- Global tables (users, orgs, memberships, sessions) are reached only by auth code.
-- Every tenant table has org_id and a FORCE'd RLS policy on app.org_id; the app runs as role ob2_app.

do $$ begin
  if not exists (select from pg_roles where rolname = 'ob2_app') then create role ob2_app nologin; end if;
end $$;
grant ob2_app to current_user;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text not null,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'start',
  demo boolean not null default false,
  timezone text not null default 'Asia/Tashkent',
  work_from smallint not null default 9,
  work_to smallint not null default 18,
  api_key_hash text unique,
  api_key_prefix text,
  api_key_at timestamptz,
  plan_until timestamptz,
  hook_secret text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

create table memberships (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operator')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary key (org_id, user_id)
);

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user on sessions(user_id);

create table stages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  key text not null,
  name text not null,
  color text not null,
  position smallint not null,
  kind text not null default 'open' check (kind in ('open', 'won', 'lost')),
  unique (org_id, key)
);

create table channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null check (kind in ('telegram', 'whatsapp', 'instagram', 'sms', 'widget')),
  name text not null,
  status text not null default 'demo' check (status in ('connected', 'demo', 'error')),
  config jsonb not null default '{}',
  secret text not null unique,
  widget_key text unique,
  info text,
  created_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  phone text,
  username text,
  channel text not null default 'manual',
  external_id text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  unique (org_id, channel, external_id)
);
create index contacts_phone on contacts(org_id, phone);

create table leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  conversation_id uuid,
  stage_id uuid not null references stages(id),
  title text not null,
  value bigint,
  interest text check (interest in ('yuqori', 'o''rta', 'past')),
  next_action text,
  due_at timestamptz,
  assignee_id uuid references users(id) on delete set null,
  source text not null default 'manual',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_org_stage on leads(org_id, stage_id);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  mode text not null default 'ai' check (mode in ('ai', 'human')),
  assignee_id uuid references users(id) on delete set null,
  unread int not null default 0,
  lead_id uuid references leads(id) on delete set null,
  last_text text,
  last_at timestamptz,
  last_dir text,
  first_in_at timestamptz,
  first_reply_at timestamptz,
  created_at timestamptz not null default now()
);
create index conversations_org_last on conversations(org_id, last_at desc);
alter table leads add foreign key (conversation_id) references conversations(id) on delete set null;

create table messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  author text not null check (author in ('contact', 'ai', 'user', 'system')),
  user_id uuid references users(id) on delete set null,
  text text not null,
  status text not null default 'sent',
  external_id text,
  at timestamptz not null default now()
);
create index messages_conv on messages(conversation_id, at);
create index messages_org_at on messages(org_id, at);

create table agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  kind text not null default 'chat' check (kind in ('chat', 'voice')),
  enabled boolean not null default true,
  prompt text not null default '',
  greeting text not null default '',
  handoff text[] not null default '{}',
  channel_ids uuid[] not null default '{}',
  voice text,
  replies int not null default 0,
  handoffs int not null default 0,
  created_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'running', 'paused', 'done')),
  agent_id uuid references agents(id) on delete set null,
  created_at timestamptz not null default now()
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  direction text not null default 'out',
  status text not null default 'queued',
  duration_sec int not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  summary text,
  created_at timestamptz not null default now()
);
create index calls_campaign on calls(campaign_id, status);
create index calls_org_created on calls(org_id, created_at desc);

create table usage (
  org_id uuid not null references orgs(id) on delete cascade,
  period date not null,
  messages int not null default 0,
  ai_replies int not null default 0,
  call_seconds int not null default 0,
  primary key (org_id, period)
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  plan text not null,
  months smallint not null,
  amount bigint not null,
  provider text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider_ref text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- Payme Merchant API transactions (docs/08 §Payme). Written only by the payment webhook (SYSTEM scope).
create table payme_tx (
  id text primary key,
  invoice_id uuid not null references invoices(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  amount bigint not null,
  state smallint not null,
  reason smallint,
  payme_time bigint not null,
  create_time bigint not null,
  perform_time bigint not null default 0,
  cancel_time bigint not null default 0
);

do $$
declare t text;
begin
  foreach t in array array['stages', 'channels', 'contacts', 'leads', 'conversations', 'messages', 'agents', 'campaigns', 'calls', 'usage', 'invoices', 'payme_tx'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format($p$create policy tenant on %I
      using (org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.bypass', true) = 'on')
      with check (org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.bypass', true) = 'on')$p$, t);
  end loop;
end $$;

grant usage on schema public to ob2_app;
grant select, insert, update, delete on all tables in schema public to ob2_app;
