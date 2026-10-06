-- supabase/migrations/00079_inventory_foreign_keys.sql
-- Complete the forward references left nullable in earlier migration groups.
-- These constraints are added only after products and suppliers exist.

alter table public.invoice_line_items
  add constraint invoice_line_items_product_id_fkey
  foreign key (product_id) references public.products (id);

alter table public.bill_line_items
  add constraint bill_line_items_product_id_fkey
  foreign key (product_id) references public.products (id);

alter table public.bills
  add constraint bills_supplier_id_fkey
  foreign key (supplier_id) references public.suppliers (id);

comment on column public.invoice_line_items.product_id is
  'Optional catalogue product reference; a line may remain description-only for legacy or ad hoc billing.';
comment on column public.bill_line_items.product_id is
  'Optional catalogue product reference; a line may remain description-only for legacy or ad hoc purchasing.';
comment on column public.bills.supplier_id is
  'Optional supplier reference; older bills may be recorded without a linked supplier.';
