-- Refunds restore the previous plan; Click SHOP API transactions (docs/08-tarif.md).
alter table invoices
  add column prev_plan text,
  add column prev_plan_until timestamptz;

create table click_tx (
  id bigserial primary key, -- merchant_prepare_id / merchant_confirm_id
  click_trans_id bigint not null unique,
  invoice_id uuid not null references invoices(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  amount bigint not null,
  state smallint not null default 0 check (state in (0, 1, -1)), -- prepared, completed, cancelled
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table click_tx enable row level security;
alter table click_tx force row level security;
create policy tenant on click_tx
  using (org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.bypass', true) = 'on')
  with check (org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.bypass', true) = 'on');
grant select, insert, update, delete on click_tx to ob2_app;
grant usage, select on sequence click_tx_id_seq to ob2_app;
