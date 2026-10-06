// src/config/content/features-page.ts
// The words on the features page. Each block is one capability explained in
// plain language, with the detail a buyer actually asks about.

export type FeatureIconName =
  | 'invoice'
  | 'payments'
  | 'recurring'
  | 'reminders'
  | 'clients'
  | 'expenses'
  | 'reports'
  | 'security'
  | 'projects'
  | 'inventory'
  | 'team'
  | 'integrations';

export interface FeatureBlock {
  id: string;
  icon: FeatureIconName;
  eyebrow: string;
  title: string;
  description: string;
  points: readonly string[];
}

export const FEATURES_PAGE_INTRO = {
  eyebrow: 'Features',
  title: 'Everything it takes to bill a client and be paid',
  description:
    'Invoices, payments, recurring billing, expenses and reporting in one place, built so a one person business and a ten person team can both work the way they already do.',
} as const;

export const FEATURE_BLOCKS: readonly FeatureBlock[] = [
  {
    id: 'invoicing',
    icon: 'invoice',
    eyebrow: 'Invoicing',
    title: 'Invoices your client can hand to their accountant',
    description:
      'A clean American style document with your logo, your terms, exact decimal unit prices and a total that always adds up. Once an invoice is issued it is locked, so the copy your client keeps can never quietly change.',
    points: [
      'Line items from your catalogue, with units, discounts and per line tax',
      'Tax applied before or after discount, rounding rule set by you',
      'Sequential numbering per year, series or business, without gaps',
      'A frozen snapshot of your company details on every issued document',
      'Attachments, delivery notes, purchase order references and payment terms',
      'Download as PDF, print, or share a secure link that works on a phone',
    ],
  },
  {
    id: 'payments',
    icon: 'payments',
    eyebrow: 'Payments',
    title: 'Let your client pay the way they prefer',
    description:
      'Connect the gateways you already use and your client pays from the invoice itself. Every payment is matched to the invoice, receipted and written into your books the moment it settles.',
    points: [
      'Cards, wallets, bank transfer and local payment methods via licensed partners',
      'Any other gateway added by an administrator from a configuration form',
      'Part payments, overpayments, refunds and credit notes handled properly',
      'Automatic receipt to your client and a payment record in your ledger',
      'Fees, settlement dates and payouts visible on every transaction',
      'Card details never touch our servers; the gateway hosts the payment form',
    ],
  },
  {
    id: 'recurring',
    icon: 'recurring',
    eyebrow: 'Recurring billing',
    title: 'Subscriptions, retainers and instalments',
    description:
      'Bill the same client on a schedule and stop thinking about it. Plans, proration, pauses, upgrades and failed payment recovery are all handled, and every change is written down.',
    points: [
      'Weekly, monthly, quarterly or yearly schedules with a start and end date',
      'Upgrades charged for the days remaining, downgrades at the next renewal',
      'Pause, resume and cancel with the effect on the next invoice shown first',
      'Dunning: retries on a schedule you choose, then a polite final notice',
      'Retainers with drawdown, and instalment plans with a signed agreement',
      'Usage based lines added to the next invoice automatically',
    ],
  },
  {
    id: 'reminders',
    icon: 'reminders',
    eyebrow: 'Collections',
    title: 'Reminders that collect without costing you the relationship',
    description:
      'Choose when a reminder goes out before and after the due date. Messages are sent in your client time zone, never during quiet hours, and stop the moment the invoice is paid.',
    points: [
      'Reminder schedules per client or per invoice, in your own wording',
      'Quiet hours, business day due dates and public holiday awareness',
      'Promise to pay recorded against the invoice, with a follow up date',
      'Statements of account sent on a schedule or on request',
      'A collections view showing what is overdue and by how long',
      'Every message stored with its delivery result, so nothing is in doubt',
    ],
  },
  {
    id: 'clients',
    icon: 'clients',
    eyebrow: 'Clients',
    title: 'One record for everything you know about a client',
    description:
      'Contacts, addresses, tax numbers, agreed prices, documents and the complete history of what was sent, paid and still owed.',
    points: [
      'Several contacts per client, each with their own role and language of address',
      'Billing and delivery addresses, tax identifier and payment terms',
      'Price lists so an agreed rate is applied without being looked up',
      'Duplicate detection and a safe merge that keeps every document',
      'Saved views for the lists you open every morning',
      'Client portal: one secure link to every document, no account needed',
    ],
  },
  {
    id: 'expenses',
    icon: 'expenses',
    eyebrow: 'Expenses',
    title: 'Costs captured where they happen',
    description:
      'Photograph a receipt on a phone and it becomes an expense with the supplier, date, amount and tax already read from the image. Bill it on to a client when it is rechargeable.',
    points: [
      'Receipt scanning that fills in the supplier, date, total and tax',
      'Categories mapped to your chart of accounts',
      'Rechargeable expenses added to the next client invoice with evidence',
      'Supplier bills, purchase orders and payment scheduling',
      'Bank feeds matched to expenses with rules you can teach',
      'Every claim stored with the image that supports it',
    ],
  },
  {
    id: 'projects',
    icon: 'projects',
    eyebrow: 'Service businesses',
    title: 'Projects, time and milestones',
    description:
      'Track hours against a project, approve a timesheet, then turn the approved hours into an invoice line without copying anything by hand.',
    points: [
      'Projects with budgets, rates per person and per task, and a profit view',
      'Timers and manual entries, with a weekly timesheet to approve',
      'Billable, non billable and already billed hours kept apart',
      'Milestone billing and deposits held against the final invoice',
      'Reimbursable costs carried straight onto the client invoice',
      'Capacity and utilisation reported per person and per project',
    ],
  },
  {
    id: 'reports',
    icon: 'reports',
    eyebrow: 'Reporting',
    title: 'Reports you can send to an accountant unedited',
    description:
      'Profit and loss, aged receivables and payables, tax summary, sales by client and by item, cash flow and payment performance. Every report exports as comma separated values and as a PDF, and every export carries a total row.',
    points: [
      'Any date range, compared with the period before it',
      'Filter by client, item, project, team member or tag',
      'Tax summary ready for a return, with the rate breakdown kept',
      'Journal entries and a trial balance for double entry bookkeeping',
      'Scheduled reports delivered to your inbox each month',
      'Figures computed in decimal arithmetic, so totals never drift by a cent',
    ],
  },
  {
    id: 'team',
    icon: 'team',
    eyebrow: 'Team',
    title: 'The right access for each person',
    description:
      'An owner runs the business, staff work inside the permissions they are given, an accountant reads the books, and nobody sees a business they were not invited to.',
    points: [
      'Granular permissions per staff member, down to the action',
      'Only the owner sends a document to a client; staff can draft and request',
      'Accountants invited for as long as you want, revoked in one click',
      'Approval requests for anything above a limit you set',
      'Audit trail of who changed what, when, and from where',
      'Two step verification available to everyone and enforceable by the owner',
    ],
  },
  {
    id: 'security',
    icon: 'security',
    eyebrow: 'Security',
    title: 'Built so one business can never see another',
    description:
      'Separation is enforced in the database itself, not only in the interface. Credentials are encrypted, the audit trail is tamper evident and your data remains yours to export or delete.',
    points: [
      'Row level isolation on every table, checked on every query',
      'Gateway keys and mail credentials encrypted before they are stored',
      'Audit entries chained together, so a deletion cannot pass unnoticed',
      'Daily backups, with a restore you can request and verify',
      'Export everything you hold, or ask for it to be deleted, at any time',
      'Sessions, address restrictions and timeouts set by the business owner',
    ],
  },
  {
    id: 'integrations',
    icon: 'integrations',
    eyebrow: 'Connections',
    title: 'Fits the tools you already run on',
    description:
      'A documented interface, webhooks and ready made connectors, so the rest of your stack stays in step without anybody rekeying a number.',
    points: [
      'Documented interface with keys, scoped permissions and cursor paging',
      'Webhooks with retries, signature verification and a replay queue',
      'Zapier and Make connectors, plus a browser extension for quick capture',
      'Messaging through email, short message service, Telegram and Viber',
      'Storage on the provider you prefer, with files served from a fast network',
      'Import from a spreadsheet, with opening balances and a dry run first',
    ],
  },
];

export const FEATURE_HIGHLIGHT_STATS = [
  { value: '9', label: 'Payment methods ready to connect' },
  { value: '40+', label: 'Reports and exports, each with a total row' },
  { value: '100%', label: 'Of changes written to an audit trail' },
  { value: '24/7', label: 'Availability target for the service' },
] as const;
