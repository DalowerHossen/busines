import type { Client } from '@/types/client';
import type { ISODateString, Money, UUID } from '@/types/core';
import type {
  ClientStatement,
  ClientStatementCredit,
  ClientStatementInvoice,
  ClientStatementPayment,
} from '@/lib/clients/types';
import { calculateClientStatement } from '@/lib/clients/service';

const COMPANY_ID = 'company-demo' as UUID;
const NOW = '2026-10-06T08:00:00.000Z' as ISODateString;

export interface ClientGroupOption {
  readonly id: UUID;
  readonly name: string;
  readonly color: string;
}

export interface ClientTagOption {
  readonly id: UUID;
  readonly name: string;
  readonly color: string;
}

export const CLIENT_GROUPS: readonly ClientGroupOption[] = [
  { id: 'group-retainer' as UUID, name: 'Retainer clients', color: '#2563EB' },
  { id: 'group-vip' as UUID, name: 'VIP', color: '#7C3AED' },
  { id: 'group-leads' as UUID, name: 'New leads', color: '#059669' },
];

export const CLIENT_TAGS: readonly ClientTagOption[] = [
  { id: 'tag-follow-up' as UUID, name: 'Follow up', color: '#D97706' },
  { id: 'tag-recurring' as UUID, name: 'Recurring', color: '#2563EB' },
  { id: 'tag-overdue' as UUID, name: 'Overdue', color: '#DC2626' },
];

function client(input: {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly phone: string;
  readonly groupId: string;
  readonly tagIds: readonly string[];
  readonly balance: string;
  readonly lastActivity: string;
  readonly isArchived?: boolean;
}): Client {
  return {
    id: input.id as UUID,
    companyId: COMPANY_ID,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    displayName: input.displayName,
    companyNameOnInvoice: input.displayName,
    email: input.email,
    phone: input.phone,
    billingAddress: null,
    shippingAddress: null,
    taxId: null,
    defaultCurrency: 'USD' as Client['defaultCurrency'],
    groupId: input.groupId as UUID,
    tagIds: input.tagIds.map((tagId) => tagId as UUID),
    notes: null,
    isArchived: input.isArchived ?? false,
  };
}

export const CLIENTS: readonly Client[] = [
  client({
    id: 'client-acme',
    displayName: 'Acme Studio',
    email: 'hello@acmestudio.example',
    phone: '+1 415 555 0188',
    groupId: 'group-retainer',
    tagIds: ['tag-recurring'],
    balance: '$1,240.00',
    lastActivity: 'Today, 9:12 AM',
  }),
  client({
    id: 'client-brightline',
    displayName: 'Brightline Works',
    email: 'finance@brightline.example',
    phone: '+1 212 555 0144',
    groupId: 'group-vip',
    tagIds: ['tag-recurring', 'tag-follow-up'],
    balance: '$3,680.00',
    lastActivity: 'Yesterday, 4:20 PM',
  }),
  client({
    id: 'client-lumen',
    displayName: 'Lumen Retail',
    email: 'accounts@lumenretail.example',
    phone: '+1 312 555 0172',
    groupId: 'group-retainer',
    tagIds: ['tag-overdue', 'tag-follow-up'],
    balance: '$860.00',
    lastActivity: 'Oct 3, 2026',
  }),
  client({
    id: 'client-oak',
    displayName: 'Oak & Field',
    email: 'team@oakandfield.example',
    phone: '+1 206 555 0135',
    groupId: 'group-leads',
    tagIds: [],
    balance: '$0.00',
    lastActivity: 'Sep 28, 2026',
  }),
  client({
    id: 'client-harbor',
    displayName: 'Harbor & Co.',
    email: 'billing@harborco.example',
    phone: '+1 617 555 0119',
    groupId: 'group-vip',
    tagIds: ['tag-recurring'],
    balance: '$2,400.00',
    lastActivity: 'Sep 24, 2026',
  }),
];

export const CLIENT_STATEMENT: ClientStatement = buildStatement('client-acme');

export function getClient(clientId: string): Client | undefined {
  return CLIENTS.find((item) => item.id === clientId);
}

export function getClientGroup(groupId: string | null): ClientGroupOption | undefined {
  return CLIENT_GROUPS.find((group) => group.id === groupId);
}

export function getClientTags(tagIds: readonly string[]): readonly ClientTagOption[] {
  return CLIENT_TAGS.filter((tag) => tagIds.includes(tag.id));
}

export function buildStatement(clientId: string): ClientStatement {
  const invoices: readonly ClientStatementInvoice[] = [
    {
      id: 'invoice-1042',
      clientId,
      invoiceNumber: 'INV-1042',
      issuedAt: '2026-10-04T09:00:00.000Z',
      total: { amount: '1240.00' as Money['amount'], currency: 'USD' as Money['currency'] },
    },
    {
      id: 'invoice-1038',
      clientId,
      invoiceNumber: 'INV-1038',
      issuedAt: '2026-09-18T09:00:00.000Z',
      total: { amount: '980.00' as Money['amount'], currency: 'USD' as Money['currency'] },
    },
  ];
  const payments: readonly ClientStatementPayment[] = [
    {
      id: 'payment-401',
      clientId,
      reference: 'PAY-401',
      paidAt: '2026-09-22T10:00:00.000Z',
      amount: { amount: '980.00' as Money['amount'], currency: 'USD' as Money['currency'] },
    },
  ];
  const credits: readonly ClientStatementCredit[] = [];
  return calculateClientStatement({
    clientId,
    currency: 'USD',
    openingBalance: { amount: '0' as Money['amount'], currency: 'USD' as Money['currency'] },
    invoices,
    payments,
    credits,
  });
}

export function formatCurrency(amount: string, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount));
}
