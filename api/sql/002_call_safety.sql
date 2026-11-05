-- Outbound call safety (docs/05 §Qo'ng'iroqlar, docs/07): do-not-call list and the consent confirmation on a campaign.
alter table contacts
  add column do_not_call_at timestamptz,
  add column do_not_call_reason text;

alter table campaigns
  add column consent_at timestamptz,
  add column consent_by uuid references users(id) on delete set null;

create index contacts_do_not_call on contacts (org_id, phone) where do_not_call_at is not null;
create index calls_campaign_status on calls (campaign_id, status);
