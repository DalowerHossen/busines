-- supabase/migrations/00046_invoice_estimate_pdf_hash_fields.sql
-- V3.8: a hash of the exact rendered invoice/estimate PDF, stored so a
-- dispute evidence pack can prove the document the client was shown has
-- not been altered since it was sent. The PDF renderer itself is added in
-- Phase 22; this migration only adds the columns it will write into.

alter table public.invoices
  add column rendered_pdf_hash text null,
  add column rendered_pdf_hash_computed_at timestamptz null;

alter table public.estimates
  add column rendered_pdf_hash text null,
  add column rendered_pdf_hash_computed_at timestamptz null;

comment on column public.invoices.rendered_pdf_hash is
  'SHA-256 hash of the exact PDF bytes generated and sent to the client, for tamper-evident dispute evidence (V3.8).';
comment on column public.estimates.rendered_pdf_hash is
  'SHA-256 hash of the exact PDF bytes generated and sent to the client, for tamper-evident dispute evidence (V3.8).';
