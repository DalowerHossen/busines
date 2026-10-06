import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client, ClientGroup, ClientTag } from '@/types/client';
import type { Address, CountryCode, CurrencyCode, UUID } from '@/types/core';
import { clientNotFound, clientTenantScopeDenied } from './errors';
import type { ClientEditableFields, ClientListQuery, ClientStore } from './types';

interface ClientRow {
  readonly id: string;
  readonly company_id: string;
  readonly display_name: string;
  readonly company_name_on_invoice: string | null;
  readonly email: string;
  readonly phone: string | null;
  readonly billing_address_line1: string | null;
  readonly billing_address_line2: string | null;
  readonly billing_city: string | null;
  readonly billing_state: string | null;
  readonly billing_postal_code: string | null;
  readonly billing_country_code: string | null;
  readonly shipping_address_line1: string | null;
  readonly shipping_address_line2: string | null;
  readonly shipping_city: string | null;
  readonly shipping_state: string | null;
  readonly shipping_postal_code: string | null;
  readonly shipping_country_code: string | null;
  readonly tax_id: string | null;
  readonly default_currency_code: string;
  readonly group_id: string | null;
  readonly notes: string | null;
  readonly is_archived: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

interface TagAssignmentRow {
  readonly client_id: string;
  readonly tag_id: string;
}

interface GroupRow {
  readonly id: string;
  readonly company_id: string;
  readonly name: string;
  readonly color: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

type TagRow = GroupRow;

export class SupabaseClientStore implements ClientStore {
  constructor(private readonly client: SupabaseClient) {}

  async list(input: ClientListQuery): Promise<readonly Client[]> {
    let query = this.client
      .from('clients')
      .select('*')
      .eq('company_id', input.companyId)
      .is('deleted_at', null);
    if (!input.includeArchived) query = query.eq('is_archived', false);
    if (input.groupId) query = query.eq('group_id', input.groupId);
    if (input.search?.trim()) {
      query = query.ilike('display_name', `%${escapeLike(input.search.trim())}%`);
    }
    const { data, error } = await query.order('display_name', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as ClientRow[];
    const clients = await this.withTagIds(input.companyId, rows);
    return input.tagId
      ? clients.filter((client) => client.tagIds.includes(input.tagId as UUID))
      : clients;
  }

  async findById(input: {
    readonly companyId: string;
    readonly clientId: string;
  }): Promise<Client | null> {
    const { data, error } = await this.client
      .from('clients')
      .select('*')
      .eq('company_id', input.companyId)
      .eq('id', input.clientId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [mapped] = await this.withTagIds(input.companyId, [data as ClientRow]);
    return mapped ?? null;
  }

  async create(input: {
    readonly companyId: string;
    readonly data: ClientEditableFields;
  }): Promise<Client> {
    await this.assertRelations(input.companyId, input.data);
    const { data, error } = await this.client
      .from('clients')
      .insert(toClientInsert(input.companyId, input.data))
      .select('*')
      .single();
    if (error) throw error;
    await this.replaceTags(input.companyId, data.id, input.data.tagIds);
    return this.requireCreated(input.companyId, data as ClientRow);
  }

  async update(input: {
    readonly companyId: string;
    readonly clientId: string;
    readonly data: ClientEditableFields;
  }): Promise<Client> {
    await this.assertRelations(input.companyId, input.data);
    const { data, error } = await this.client
      .from('clients')
      .update(toClientUpdate(input.data))
      .eq('company_id', input.companyId)
      .eq('id', input.clientId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw clientNotFound();
    await this.replaceTags(input.companyId, input.clientId, input.data.tagIds);
    return this.requireCreated(input.companyId, data as ClientRow);
  }

  async archive(input: {
    readonly companyId: string;
    readonly clientId: string;
    readonly archived: boolean;
  }): Promise<Client> {
    const { data, error } = await this.client
      .from('clients')
      .update({ is_archived: input.archived })
      .eq('company_id', input.companyId)
      .eq('id', input.clientId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw clientNotFound();
    return this.requireCreated(input.companyId, data as ClientRow);
  }

  async merge(input: {
    readonly companyId: string;
    readonly sourceClientId: string;
    readonly targetClientId: string;
  }): Promise<Client> {
    const { data, error } = await this.client.rpc('merge_client_records', {
      p_company_id: input.companyId,
      p_source_client_id: input.sourceClientId,
      p_target_client_id: input.targetClientId,
    });
    if (error) throw error;
    if (!data || typeof data !== 'object') throw clientNotFound();
    return this.requireCreated(input.companyId, data as ClientRow);
  }

  async createGroup(input: {
    readonly companyId: string;
    readonly name: string;
    readonly color: string | null;
  }): Promise<ClientGroup> {
    const { data, error } = await this.client
      .from('client_groups')
      .insert({ company_id: input.companyId, name: input.name, color: input.color })
      .select('*')
      .single();
    if (error) throw error;
    return mapGroup(data as GroupRow);
  }

  async createTag(input: {
    readonly companyId: string;
    readonly name: string;
    readonly color: string | null;
  }): Promise<ClientTag> {
    const { data, error } = await this.client
      .from('client_tags')
      .insert({ company_id: input.companyId, name: input.name, color: input.color })
      .select('*')
      .single();
    if (error) throw error;
    return mapTag(data as TagRow);
  }

  private async withTagIds(
    companyId: string,
    rows: readonly ClientRow[]
  ): Promise<readonly Client[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const { data, error } = await this.client
      .from('client_tag_assignments')
      .select('client_id, tag_id')
      .eq('company_id', companyId)
      .in('client_id', ids);
    if (error) throw error;
    const tagsByClient = new Map<string, string[]>();
    for (const assignment of (data ?? []) as TagAssignmentRow[]) {
      const tags = tagsByClient.get(assignment.client_id) ?? [];
      tags.push(assignment.tag_id);
      tagsByClient.set(assignment.client_id, tags);
    }
    return rows.map((row) => mapClient(row, tagsByClient.get(row.id) ?? []));
  }

  private async replaceTags(
    companyId: string,
    clientId: string,
    tagIds: readonly UUID[]
  ): Promise<void> {
    const { error: deleteError } = await this.client
      .from('client_tag_assignments')
      .delete()
      .eq('company_id', companyId)
      .eq('client_id', clientId);
    if (deleteError) throw deleteError;
    if (tagIds.length === 0) return;
    const { error } = await this.client
      .from('client_tag_assignments')
      .insert(
        tagIds.map((tagId) => ({ company_id: companyId, client_id: clientId, tag_id: tagId }))
      );
    if (error) throw error;
  }

  private async assertRelations(companyId: string, data: ClientEditableFields): Promise<void> {
    if (data.groupId) {
      const { data: group, error } = await this.client
        .from('client_groups')
        .select('id')
        .eq('company_id', companyId)
        .eq('id', data.groupId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      if (!group) throw clientTenantScopeDenied();
    }
    if (data.tagIds.length === 0) return;
    const { data: tags, error } = await this.client
      .from('client_tags')
      .select('id')
      .eq('company_id', companyId)
      .in('id', data.tagIds)
      .is('deleted_at', null);
    if (error) throw error;
    if ((tags ?? []).length !== data.tagIds.length) throw clientTenantScopeDenied();
  }

  private async requireCreated(companyId: string, row: ClientRow): Promise<Client> {
    const [client] = await this.withTagIds(companyId, [row]);
    if (!client) throw clientNotFound();
    return client;
  }
}

function toClientInsert(companyId: string, data: ClientEditableFields): Record<string, unknown> {
  return { company_id: companyId, ...toClientUpdate(data) };
}

function toClientUpdate(data: ClientEditableFields): Record<string, unknown> {
  return {
    display_name: data.displayName,
    company_name_on_invoice: data.companyNameOnInvoice,
    email: data.email,
    phone: data.phone,
    ...addressColumns('billing', data.billingAddress),
    ...addressColumns('shipping', data.shippingAddress),
    tax_id: data.taxId,
    default_currency_code: data.defaultCurrency,
    group_id: data.groupId,
    notes: data.notes,
  };
}

function addressColumns(
  prefix: 'billing' | 'shipping',
  address: Address | null
): Record<string, string | null> {
  return {
    [`${prefix}_address_line1`]: address?.line1 ?? null,
    [`${prefix}_address_line2`]: address?.line2 ?? null,
    [`${prefix}_city`]: address?.city ?? null,
    [`${prefix}_state`]: address?.state ?? null,
    [`${prefix}_postal_code`]: address?.postalCode ?? null,
    [`${prefix}_country_code`]: address?.country ?? null,
  };
}

function mapClient(row: ClientRow, tagIds: readonly string[]): Client {
  return {
    id: row.id as UUID,
    companyId: row.company_id as UUID,
    displayName: row.display_name,
    companyNameOnInvoice: row.company_name_on_invoice,
    email: row.email,
    phone: row.phone,
    billingAddress: mapAddress(
      row.billing_address_line1,
      row.billing_address_line2,
      row.billing_city,
      row.billing_state,
      row.billing_postal_code,
      row.billing_country_code
    ),
    shippingAddress: mapAddress(
      row.shipping_address_line1,
      row.shipping_address_line2,
      row.shipping_city,
      row.shipping_state,
      row.shipping_postal_code,
      row.shipping_country_code
    ),
    taxId: row.tax_id,
    defaultCurrency: row.default_currency_code as CurrencyCode,
    groupId: row.group_id as UUID | null,
    tagIds: tagIds.map((tagId) => tagId as UUID),
    notes: row.notes,
    isArchived: row.is_archived,
    createdAt: row.created_at as Client['createdAt'],
    updatedAt: row.updated_at as Client['updatedAt'],
    deletedAt: row.deleted_at as Client['deletedAt'],
  };
}

function mapAddress(
  line1: string | null,
  line2: string | null,
  city: string | null,
  state: string | null,
  postalCode: string | null,
  country: string | null
): Address | null {
  if (!line1 || !city || !country) return null;
  return { line1, line2, city, state, postalCode, country: country as CountryCode };
}

function mapGroup(row: GroupRow): ClientGroup {
  return {
    id: row.id as UUID,
    companyId: row.company_id as UUID,
    name: row.name,
    color: row.color,
    createdAt: row.created_at as ClientGroup['createdAt'],
    updatedAt: row.updated_at as ClientGroup['updatedAt'],
    deletedAt: row.deleted_at as ClientGroup['deletedAt'],
  };
}

function mapTag(row: TagRow): ClientTag {
  return mapGroup(row);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/gu, (character) => `\\${character}`);
}
