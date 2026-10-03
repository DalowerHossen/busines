-- supabase/migrations/00026_invoice_comments.sql
-- An internal comment/note thread entry on an invoice, visible only to
-- the owner and staff -- never shown to the client on the tokenized
-- access page. Comments are immutable once posted (no updated_at); a
-- deleted_at column supports moderation/retraction only.

create table public.invoice_comments (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  invoice_id uuid not null references public.invoices (id),
  author_user_id uuid not null references public.users (id),
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index invoice_comments_invoice_id_idx
  on public.invoice_comments (invoice_id)
  where deleted_at is null;
create index invoice_comments_company_id_idx on public.invoice_comments (company_id);

comment on table public.invoice_comments is
  'Internal, immutable comment thread on an invoice. Never visible to the client.';
