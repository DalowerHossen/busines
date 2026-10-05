-- supabase/migrations/00057_tax_compliance_fields.sql
-- Remaining R4 tax/compliance fields that belong on existing tables rather
-- than new ones: R4.4 (VAT/GST number) is already covered by
-- clients.tax_id (Phase 6) and company_profiles.tax_id (Phase 5), so only
-- R4.5, R4.6, and R4.7 need new columns here.

-- R4.5: a tax-exempt client is never charged tax regardless of the line
-- item's tax_rate_percent; enforced at the application layer.
alter table public.clients
  add column is_tax_exempt boolean not null default false;

-- R4.6: the month (1-12) a company's fiscal year begins, used by the
-- Profit & Loss / Balance Sheet / Cash Flow reports added in a later
-- reporting phase.
alter table public.company_profiles
  add column fiscal_year_start_month smallint not null default 1,
  add constraint company_profiles_fiscal_year_start_month_valid
    check (fiscal_year_start_month between 1 and 12);

-- R4.7: how line-item/invoice totals round sub-cent amounts.
alter table public.company_profiles
  add column rounding_mode text not null default 'standard',
  add constraint company_profiles_rounding_mode_valid
    check (rounding_mode in ('standard', 'round_up', 'round_down', 'none'));

comment on column public.clients.is_tax_exempt is
  'R4.5: when true, this client is never charged tax regardless of a line item''s tax_rate_percent.';
comment on column public.company_profiles.fiscal_year_start_month is
  'R4.6: month (1 = January) a company''s fiscal year begins, used by financial reports.';
comment on column public.company_profiles.rounding_mode is
  'R4.7: how sub-cent amounts round on invoice/estimate totals.';
