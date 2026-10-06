-- supabase/migrations/00034_install_business_triggers.sql
-- Standard triggers, audit coverage and record numbering for the client
-- directory and the catalogue.

select public.install_standard_triggers('clients');
select public.install_standard_triggers('client_contacts');
select public.install_standard_triggers('client_addresses');
select public.install_standard_triggers('tax_rates');
select public.install_standard_triggers('tax_groups');
select public.install_standard_triggers('product_categories');
select public.install_standard_triggers('units_of_measure');
select public.install_standard_triggers('products');
select public.install_standard_triggers('price_lists');
select public.install_standard_triggers('price_list_items');
select public.install_standard_triggers('tags');
select public.install_standard_triggers('saved_views');

select public.install_timestamp_trigger('tax_group_members');

-- Records that affect money or the client relationship are audited. Tags and
-- saved views are presentation only and stay out of the trail to keep it
-- readable.
select public.install_audit_trigger('clients');
select public.install_audit_trigger('client_contacts');
select public.install_audit_trigger('client_addresses');
select public.install_audit_trigger('tax_rates');
select public.install_audit_trigger('tax_groups');
select public.install_audit_trigger('products');
select public.install_audit_trigger('price_lists');
select public.install_audit_trigger('price_list_items');

-- Assigns the next client reference when the caller did not supply one.
-- Client references are not statutory documents, so they use their own simple
-- per company sequence rather than the gapless document counter. An advisory
-- lock keeps two simultaneous inserts from claiming the same number.
create or replace function public.assign_client_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next integer;
begin
  if new.client_number is not null and length(btrim(new.client_number)) > 0 then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.company_id::text || ':clients', 0));

  select coalesce(max(substring(client_number from '^CL-([0-9]+)$')::integer), 0) + 1
    into v_next
    from public.clients
   where company_id = new.company_id
     and client_number ~ '^CL-[0-9]+$';

  new.client_number := 'CL-' || lpad(v_next::text, 4, '0');

  return new;
end;
$$;

comment on function public.assign_client_number() is
  'Fills the client reference from a per company sequence when none was supplied.';

create trigger clients_assign_number
  before insert on public.clients
  for each row execute function public.assign_client_number();

-- Merges a duplicate client into the record that is kept. Documents are moved
-- by the modules that own them; this routine handles the directory itself and
-- leaves an audit entry behind.
create or replace function public.merge_clients(
  p_source_client_id uuid,
  p_target_client_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_target_company_id uuid;
begin
  if p_source_client_id = p_target_client_id then
    raise exception 'A client cannot be merged into itself'
      using errcode = '22023';
  end if;

  select company_id into v_company_id
    from public.clients
   where id = p_source_client_id and deleted_at is null;

  select company_id into v_target_company_id
    from public.clients
   where id = p_target_client_id and deleted_at is null;

  if v_company_id is null or v_target_company_id is null then
    raise exception 'Both clients must exist before they can be merged'
      using errcode = 'P0002';
  end if;

  if v_company_id <> v_target_company_id then
    raise exception 'Clients from different companies cannot be merged'
      using errcode = '42501';
  end if;

  if not public.can_write_company_data(v_company_id) then
    raise exception 'You are not allowed to merge clients in this company'
      using errcode = '42501';
  end if;

  update public.client_contacts
     set client_id = p_target_client_id,
         is_primary = false,
         updated_at = now()
   where client_id = p_source_client_id
     and deleted_at is null;

  update public.client_addresses
     set client_id = p_target_client_id,
         is_default = false,
         updated_at = now()
   where client_id = p_source_client_id
     and deleted_at is null;

  update public.clients
     set merged_into_client_id = p_target_client_id,
         merged_at = now(),
         status = 'archived',
         updated_at = now()
   where id = p_source_client_id;

  perform public.record_manual_audit_entry(
    'update',
    'clients',
    p_source_client_id,
    v_company_id,
    'Merged a duplicate client record',
    jsonb_build_object('merged_into', p_target_client_id)
  );

  return p_target_client_id;
end;
$$;

comment on function public.merge_clients(uuid, uuid) is
  'Moves contacts and addresses onto the surviving client and archives the duplicate.';
