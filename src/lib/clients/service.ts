import {
  clientCreateSchema,
  clientGroupCreateSchema,
  clientTagCreateSchema,
  clientUpdateSchema,
} from '@/lib/validators/client';
import { addMoney, createMoney, subtractMoney } from '@/lib/core/money';
import type { Client, ClientActivityEntry } from '@/types/client';
import type { Address, CountryCode, CurrencyCode, Money, UUID } from '@/types/core';
import {
  clientMergeConflict,
  clientNotFound,
  clientTenantScopeDenied,
  duplicateClient,
  invalidClientRequest,
} from './errors';
import type {
  ClientActor,
  ClientEditableFields,
  ClientStatement,
  ClientStatementCredit,
  ClientStatementInvoice,
  ClientStatementPayment,
  ClientStatementRow,
  ClientStore,
  ClientTimeline,
  DuplicateMatchGroup,
} from './types';

export async function listClients(input: {
  readonly actor: ClientActor;
  readonly query?: string;
  readonly groupId?: string | null;
  readonly tagId?: string | null;
  readonly includeArchived?: boolean;
  readonly store: ClientStore;
}): Promise<readonly Client[]> {
  assertActorCompany(input.actor, input.actor.companyId);
  return input.store.list({
    companyId: input.actor.companyId,
    search: input.query?.trim() || undefined,
    groupId: input.groupId,
    tagId: input.tagId,
    includeArchived: input.includeArchived,
  });
}

export async function createClient(input: {
  readonly actor: ClientActor;
  readonly data: unknown;
  readonly store: ClientStore;
}): Promise<Client> {
  assertCanManage(input.actor);
  const data = parseClientInput(clientCreateSchema.safeParse(input.data));
  return input.store.create({ companyId: input.actor.companyId, data });
}

export async function updateClient(input: {
  readonly actor: ClientActor;
  readonly data: unknown;
  readonly store: ClientStore;
}): Promise<Client> {
  assertCanManage(input.actor);
  const parsed = clientUpdateSchema.safeParse(input.data);
  if (!parsed.success) throw invalidClientRequest();
  const { id, ...editable } = parsed.data;
  return input.store.update({
    companyId: input.actor.companyId,
    clientId: id,
    data: normalizeEditableFields(editable),
  });
}

export async function archiveClient(input: {
  readonly actor: ClientActor;
  readonly clientId: string;
  readonly archived: boolean;
  readonly store: ClientStore;
}): Promise<Client> {
  assertCanManage(input.actor);
  assertClientId(input.clientId);
  return input.store.archive({
    companyId: input.actor.companyId,
    clientId: input.clientId,
    archived: input.archived,
  });
}

export async function createClientGroup(input: {
  readonly actor: ClientActor;
  readonly data: unknown;
  readonly store: ClientStore;
}) {
  assertCanManage(input.actor);
  const parsed = clientGroupCreateSchema.safeParse(input.data);
  if (!parsed.success) throw invalidClientRequest();
  return input.store.createGroup({
    companyId: input.actor.companyId,
    name: parsed.data.name,
    color: parsed.data.color ?? null,
  });
}

export async function createClientTag(input: {
  readonly actor: ClientActor;
  readonly data: unknown;
  readonly store: ClientStore;
}) {
  assertCanManage(input.actor);
  const parsed = clientTagCreateSchema.safeParse(input.data);
  if (!parsed.success) throw invalidClientRequest();
  return input.store.createTag({
    companyId: input.actor.companyId,
    name: parsed.data.name,
    color: parsed.data.color ?? null,
  });
}

export async function mergeClients(input: {
  readonly actor: ClientActor;
  readonly sourceClientId: string;
  readonly targetClientId: string;
  readonly store: ClientStore;
}): Promise<Client> {
  assertCanManage(input.actor);
  assertClientId(input.sourceClientId);
  assertClientId(input.targetClientId);
  if (input.sourceClientId === input.targetClientId) throw clientMergeConflict();
  const [source, target] = await Promise.all([
    input.store.findById({ companyId: input.actor.companyId, clientId: input.sourceClientId }),
    input.store.findById({ companyId: input.actor.companyId, clientId: input.targetClientId }),
  ]);
  if (!source || !target) throw clientNotFound();
  if (source.companyId !== input.actor.companyId || target.companyId !== input.actor.companyId) {
    throw clientTenantScopeDenied();
  }
  if (
    source.email === target.email &&
    source.phone === target.phone &&
    source.displayName === target.displayName
  ) {
    throw duplicateClient();
  }
  return input.store.merge({
    companyId: input.actor.companyId,
    sourceClientId: input.sourceClientId,
    targetClientId: input.targetClientId,
  });
}

export function findPotentialDuplicates(
  clients: readonly Client[]
): readonly DuplicateMatchGroup[] {
  const groups = new Map<
    string,
    { ids: Set<Client['id']>; reasons: Set<'email' | 'phone' | 'display_name'> }
  >();
  for (const client of clients) {
    const keys = [
      { value: normalizeEmail(client.email), reason: 'email' as const },
      { value: normalizePhone(client.phone), reason: 'phone' as const },
      { value: normalizeName(client.displayName), reason: 'display_name' as const },
    ];
    for (const key of keys) {
      if (!key.value) continue;
      const existing = groups.get(key.value) ?? {
        ids: new Set<Client['id']>(),
        reasons: new Set(),
      };
      existing.ids.add(client.id);
      existing.reasons.add(key.reason);
      groups.set(key.value, existing);
    }
  }
  const output = new Map<string, DuplicateMatchGroup>();
  for (const group of groups.values()) {
    if (group.ids.size < 2) continue;
    const clientIds = [...group.ids].sort();
    const key = clientIds.join('|');
    const current = output.get(key);
    output.set(key, {
      clientIds,
      matchReasons: [...new Set([...(current?.matchReasons ?? []), ...group.reasons])],
    });
  }
  return [...output.values()].sort((left, right) =>
    left.clientIds.join('|').localeCompare(right.clientIds.join('|'))
  );
}

export function calculateClientStatement(input: {
  readonly clientId: string;
  readonly currency: string;
  readonly openingBalance: Money;
  readonly invoices: readonly ClientStatementInvoice[];
  readonly payments: readonly ClientStatementPayment[];
  readonly credits: readonly ClientStatementCredit[];
}): ClientStatement {
  assertClientId(input.clientId);
  const openingBalance = createMoney(input.openingBalance.amount, input.currency, {
    allowNegative: true,
  });
  const zero = createMoney('0', input.currency, { allowNegative: true });
  let balance = openingBalance;
  let totalInvoiced = zero;
  let totalPaid = zero;
  let totalCredits = zero;
  const events: readonly StatementEvent[] = [
    ...input.invoices.map((invoice) => ({
      id: invoice.id,
      clientId: invoice.clientId,
      occurredAt: invoice.issuedAt,
      type: 'invoice' as const,
      reference: invoice.invoiceNumber,
      description: 'Invoice issued',
      amount: invoice.total,
    })),
    ...input.payments.map((payment) => ({
      id: payment.id,
      clientId: payment.clientId,
      occurredAt: payment.paidAt,
      type: 'payment' as const,
      reference: payment.reference,
      description: 'Payment received',
      amount: payment.amount,
    })),
    ...input.credits.map((credit) => ({
      id: credit.id,
      clientId: credit.clientId,
      occurredAt: credit.issuedAt,
      type: 'credit' as const,
      reference: credit.reference,
      description: 'Credit applied',
      amount: credit.amount,
    })),
  ];
  for (const event of events) {
    if (event.clientId !== input.clientId) throw clientTenantScopeDenied();
    assertMoneyCurrency(event.amount, input.currency);
  }
  const rows = [...events]
    .sort(
      (left, right) =>
        left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id)
    )
    .map((event): ClientStatementRow => {
      if (event.type === 'invoice') {
        balance = addMoney(balance, event.amount);
        totalInvoiced = addMoney(totalInvoiced, event.amount);
        return { ...event, amount: event.amount, balance };
      }
      balance = subtractMoney(balance, event.amount, { roundingMode: 'half_even' });
      if (event.type === 'payment') totalPaid = addMoney(totalPaid, event.amount);
      else totalCredits = addMoney(totalCredits, event.amount);
      return {
        ...event,
        amount: createMoney(`-${event.amount.amount}`, input.currency, { allowNegative: true }),
        balance,
      };
    });
  return {
    clientId: input.clientId,
    currency: input.currency,
    openingBalance,
    rows,
    totalInvoiced,
    totalPaid,
    totalCredits,
    closingBalance: balance,
  };
}

export function buildClientTimeline(input: {
  readonly clientId: string;
  readonly entries: readonly ClientActivityEntry[];
}): ClientTimeline {
  assertClientId(input.clientId);
  if (input.entries.some((entry) => entry.clientId !== input.clientId)) {
    throw clientTenantScopeDenied();
  }
  return {
    clientId: input.clientId,
    entries: [...input.entries].sort(
      (left, right) =>
        right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id)
    ),
  };
}

interface StatementEvent {
  readonly id: string;
  readonly clientId: string;
  readonly occurredAt: string;
  readonly type: 'invoice' | 'payment' | 'credit';
  readonly reference: string;
  readonly description: string;
  readonly amount: Money;
}

function parseClientInput(
  result: ReturnType<typeof clientCreateSchema.safeParse>
): ClientEditableFields {
  if (!result.success) throw invalidClientRequest();
  return normalizeEditableFields(result.data);
}

function normalizeEditableFields(input: {
  readonly displayName: string;
  readonly companyNameOnInvoice?: string | null;
  readonly email: string;
  readonly phone?: string | null;
  readonly billingAddress?: RawAddress | null;
  readonly shippingAddress?: RawAddress | null;
  readonly taxId?: string | null;
  readonly defaultCurrency: string;
  readonly groupId?: string | null;
  readonly tagIds: readonly string[];
  readonly notes?: string | null;
}): ClientEditableFields {
  return {
    displayName: input.displayName.trim(),
    companyNameOnInvoice: input.companyNameOnInvoice ?? null,
    email: input.email.trim().toLowerCase(),
    phone: input.phone ?? null,
    billingAddress: input.billingAddress ? normalizeAddress(input.billingAddress) : null,
    shippingAddress: input.shippingAddress ? normalizeAddress(input.shippingAddress) : null,
    taxId: input.taxId ?? null,
    defaultCurrency: input.defaultCurrency.toUpperCase() as CurrencyCode,
    groupId: input.groupId ? (input.groupId as UUID) : null,
    tagIds: input.tagIds.map((tagId) => tagId as UUID),
    notes: input.notes ?? null,
  };
}

type RawAddress = Omit<Address, 'country'> & { readonly country: string };

function normalizeAddress(address: RawAddress): Address {
  return { ...address, country: address.country.toUpperCase() as CountryCode };
}

function assertCanManage(actor: ClientActor): void {
  assertActorCompany(actor, actor.companyId);
  if (actor.role === 'owner') return;
  if (actor.role === 'staff' && actor.permissions?.includes('manage_clients')) return;
  throw clientTenantScopeDenied();
}

function assertActorCompany(actor: ClientActor, companyId: string): void {
  if (!actor.userId.trim() || !companyId.trim() || actor.companyId !== companyId) {
    throw clientTenantScopeDenied();
  }
}

function assertClientId(value: string): void {
  if (!value.trim()) throw invalidClientRequest();
}

function assertMoneyCurrency(value: Money, currency: string): void {
  if (value.currency !== currency) throw invalidClientRequest();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string | null): string {
  return value ? value.replace(/\D/gu, '') : '';
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, '');
}
