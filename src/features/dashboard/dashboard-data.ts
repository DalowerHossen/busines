import type { Notification } from '@/types/notification';
import type { SearchDocument } from '@/lib/core/types';
import type { ISODateString, UUID } from '@/types/core';

export interface DashboardStat {
  readonly label: string;
  readonly value: string;
  readonly change: string;
  readonly changeDirection: 'up' | 'down' | 'neutral';
  readonly description: string;
}

export interface RevenuePoint {
  readonly label: string;
  readonly amount: number;
  readonly displayAmount: string;
}

export interface DashboardInvoiceRow {
  readonly id: string;
  readonly number: string;
  readonly client: string;
  readonly issuedAt: string;
  readonly dueAt: string;
  readonly amount: string;
  readonly status: 'paid' | 'pending' | 'overdue' | 'draft';
}

export interface DashboardTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly tone: 'brand' | 'warning' | 'success';
  readonly iconName: 'FilePlus2' | 'Users' | 'ShieldCheck';
}

export interface DashboardData {
  readonly firstName: string;
  readonly companyName: string;
  readonly currencyCode: string;
  readonly stats: readonly DashboardStat[];
  readonly revenue: readonly RevenuePoint[];
  readonly recentInvoices: readonly DashboardInvoiceRow[];
  readonly tasks: readonly DashboardTask[];
}

const TENANT_ID = 'company-demo' as UUID;
const USER_ID = 'user-owner-demo' as UUID;
const TIMESTAMP = '2026-10-06T08:00:00.000Z' as ISODateString;

export const DASHBOARD_DATA: DashboardData = {
  firstName: 'Alex',
  companyName: 'Northstar Studio',
  currencyCode: 'USD',
  stats: [
    {
      label: 'Collected this month',
      value: '$24,680.00',
      change: '+12.8%',
      changeDirection: 'up',
      description: 'Compared with last month',
    },
    {
      label: 'Outstanding balance',
      value: '$8,420.00',
      change: '-4.6%',
      changeDirection: 'down',
      description: 'Across 18 open invoices',
    },
    {
      label: 'Payment success rate',
      value: '96.4%',
      change: '+2.1%',
      changeDirection: 'up',
      description: 'Across the last 30 days',
    },
    {
      label: 'Active clients',
      value: '128',
      change: '+8',
      changeDirection: 'up',
      description: 'Since the start of the quarter',
    },
  ],
  revenue: [
    { label: 'May', amount: 62, displayAmount: '$16.4k' },
    { label: 'Jun', amount: 74, displayAmount: '$19.8k' },
    { label: 'Jul', amount: 58, displayAmount: '$15.6k' },
    { label: 'Aug', amount: 82, displayAmount: '$21.9k' },
    { label: 'Sep', amount: 71, displayAmount: '$19.1k' },
    { label: 'Oct', amount: 94, displayAmount: '$24.7k' },
  ],
  recentInvoices: [
    {
      id: 'inv-1042',
      number: 'INV-1042',
      client: 'Acme Studio',
      issuedAt: 'Oct 04, 2026',
      dueAt: 'Oct 18, 2026',
      amount: '$1,240.00',
      status: 'paid',
    },
    {
      id: 'inv-1041',
      number: 'INV-1041',
      client: 'Brightline Works',
      issuedAt: 'Oct 02, 2026',
      dueAt: 'Oct 16, 2026',
      amount: '$3,680.00',
      status: 'pending',
    },
    {
      id: 'inv-1040',
      number: 'INV-1040',
      client: 'Lumen Retail',
      issuedAt: 'Sep 28, 2026',
      dueAt: 'Oct 12, 2026',
      amount: '$860.00',
      status: 'overdue',
    },
    {
      id: 'inv-1039',
      number: 'INV-1039',
      client: 'Oak & Field',
      issuedAt: 'Sep 24, 2026',
      dueAt: 'Oct 08, 2026',
      amount: '$2,140.00',
      status: 'draft',
    },
  ],
  tasks: [
    {
      id: 'task-invoice',
      title: 'Create your next invoice',
      description: 'Turn recent work into a polished, trackable invoice.',
      href: '/invoices/new',
      tone: 'brand',
      iconName: 'FilePlus2',
    },
    {
      id: 'task-client',
      title: 'Add a client',
      description: 'Keep billing contacts and history in one place.',
      href: '/clients/new',
      tone: 'success',
      iconName: 'Users',
    },
    {
      id: 'task-security',
      title: 'Review workspace security',
      description: 'Check access, two-factor authentication, and activity.',
      href: '/settings/security',
      tone: 'warning',
      iconName: 'ShieldCheck',
    },
  ],
};

export const DASHBOARD_SEARCH_DOCUMENTS: readonly SearchDocument[] = [
  {
    id: 'search-invoice-1042',
    companyId: TENANT_ID,
    entityType: 'invoice',
    title: 'INV-1042 · Acme Studio',
    subtitle: 'Paid invoice · $1,240.00',
    searchText: 'invoice acme studio paid collected one thousand two hundred forty',
    href: '/invoices?search=INV-1042',
    updatedAt: TIMESTAMP,
  },
  {
    id: 'search-invoice-1041',
    companyId: TENANT_ID,
    entityType: 'invoice',
    title: 'INV-1041 · Brightline Works',
    subtitle: 'Payment pending · $3,680.00',
    searchText: 'invoice brightline works pending outstanding',
    href: '/invoices?search=INV-1041',
    updatedAt: '2026-10-05T12:30:00.000Z',
  },
  {
    id: 'search-client-acme',
    companyId: TENANT_ID,
    entityType: 'client',
    title: 'Acme Studio',
    subtitle: 'Client · 4 active invoices',
    searchText: 'client acme studio account contact active invoices',
    href: '/clients?search=Acme%20Studio',
    updatedAt: '2026-10-04T10:15:00.000Z',
  },
  {
    id: 'search-client-lumen',
    companyId: TENANT_ID,
    entityType: 'client',
    title: 'Lumen Retail',
    subtitle: 'Client · overdue balance',
    searchText: 'client lumen retail overdue balance follow up',
    href: '/clients?search=Lumen%20Retail',
    updatedAt: '2026-10-03T09:20:00.000Z',
  },
  {
    id: 'search-estimate-208',
    companyId: TENANT_ID,
    entityType: 'estimate',
    title: 'EST-208 · Oak & Field',
    subtitle: 'Sent yesterday · $4,800.00',
    searchText: 'estimate oak field sent proposal',
    href: '/estimates?search=EST-208',
    updatedAt: '2026-10-05T16:00:00.000Z',
  },
];

export const DASHBOARD_NOTIFICATIONS: readonly Notification[] = [
  {
    id: 'notification-invoice-paid' as UUID,
    companyId: TENANT_ID,
    createdAt: '2026-10-06T07:30:00.000Z' as ISODateString,
    updatedAt: '2026-10-06T07:30:00.000Z' as ISODateString,
    deletedAt: null,
    recipientUserId: USER_ID,
    type: 'invoice_paid',
    title: 'Invoice INV-1042 was paid',
    body: 'Acme Studio paid $1,240.00. The payment is ready to reconcile.',
    linkPath: '/invoices?search=INV-1042',
    readAt: null,
    deliveredChannels: ['in_app'],
  },
  {
    id: 'notification-invoice-overdue' as UUID,
    companyId: TENANT_ID,
    createdAt: '2026-10-05T13:10:00.000Z' as ISODateString,
    updatedAt: '2026-10-05T13:10:00.000Z' as ISODateString,
    deletedAt: null,
    recipientUserId: USER_ID,
    type: 'invoice_overdue',
    title: 'An invoice needs attention',
    body: 'INV-1040 for Lumen Retail is overdue by two days.',
    linkPath: '/invoices?search=INV-1040',
    readAt: null,
    deliveredChannels: ['in_app'],
  },
  {
    id: 'notification-estimate-approved' as UUID,
    companyId: TENANT_ID,
    createdAt: '2026-10-04T09:45:00.000Z' as ISODateString,
    updatedAt: '2026-10-04T09:45:00.000Z' as ISODateString,
    deletedAt: null,
    recipientUserId: USER_ID,
    type: 'estimate_approved',
    title: 'Estimate EST-207 was approved',
    body: 'Brightline Works approved the estimate. It is ready to convert into an invoice.',
    linkPath: '/estimates?search=EST-207',
    readAt: '2026-10-05T08:00:00.000Z' as ISODateString,
    deliveredChannels: ['in_app', 'email'],
  },
];
