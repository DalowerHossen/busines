-- supabase/migrations/00045_company_profiles_compliance_fields.sql
-- Adds the LIVE/current versions of a company's terms, refund policy, and
-- card-statement descriptor onto company_profiles (Phase 5). These are the
-- editable source values an owner maintains in Settings; the consent
-- evidence table added later in this migration group (V1,
-- 00047_payment_consent_records.sql) freezes a copy of the relevant
-- version/text onto each payment consent record at the moment a client
-- consents, so a later edit here never rewrites history.

alter table public.company_profiles
  add column statement_descriptor text null,
  add column terms_and_conditions_text text null,
  add column terms_and_conditions_version text not null default '1',
  add column refund_policy_text text null,
  add column refund_policy_version text not null default '1';

comment on column public.company_profiles.statement_descriptor is
  'Shown on a client''s card/bank statement for this company''s charges (V5.1 clear statement descriptor).';
comment on column public.company_profiles.terms_and_conditions_version is
  'Bumped by the owner whenever terms_and_conditions_text changes, so existing consent snapshots stay tied to the version a client actually agreed to.';
comment on column public.company_profiles.refund_policy_version is
  'Bumped by the owner whenever refund_policy_text changes, so existing consent snapshots stay tied to the version a client actually agreed to.';
