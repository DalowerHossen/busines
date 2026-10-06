// src/config/marketing.ts
// The words on the public website. Keeping them here means the marketing
// pages stay in one voice and a change is made in one place.

import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/app';

export interface NavLink {
  label: string;
  href: string;
}

export const MARKETING_NAV: readonly NavLink[] = [
  { label: 'Features', href: ROUTES.features },
  { label: 'Pricing', href: ROUTES.pricing },
  { label: 'Contact', href: ROUTES.contact },
];

export const HERO = {
  eyebrow: 'Invoicing, payments and subscriptions',
  title: 'Send invoices. Get paid. Grow.',
  subtitle:
    'Professional invoices in under a minute, online payments, automatic reminders and clean books, in one dashboard built for small businesses.',
  primaryCta: { label: 'Start free', href: ROUTES.register },
  secondaryCta: { label: 'See pricing', href: ROUTES.pricing },
  reassurance: 'Free plan included. No card needed to start.',
} as const;

export interface Statistic {
  value: string;
  label: string;
}

export const STATISTICS: readonly Statistic[] = [
  { value: '60s', label: 'Median time to create and send an invoice' },
  { value: '38%', label: 'Faster payment when reminders are switched on' },
  { value: '14 days', label: 'Free trial on every paid plan' },
  { value: '9', label: 'Payment methods available out of the box' },
];

export interface FeatureCard {
  title: string;
  description: string;
  icon:
    | 'invoice'
    | 'payments'
    | 'clients'
    | 'reminders'
    | 'reports'
    | 'security'
    | 'recurring'
    | 'expenses';
}

export const FEATURES: readonly FeatureCard[] = [
  {
    icon: 'invoice',
    title: 'Professional invoices',
    description:
      'American style invoices with your logo, your terms and precise decimal pricing. Issued documents are locked, so the copy your client keeps never changes.',
  },
  {
    icon: 'payments',
    title: 'Online payments',
    description:
      'Accept cards, digital wallets, bank transfer and local payment methods via licensed partners. Your client pays from the invoice itself, without creating an account.',
  },
  {
    icon: 'recurring',
    title: 'Subscriptions and retainers',
    description:
      'Bill the same client every month without touching it. Plans, proration, pauses, dunning and instalments are all handled for you.',
  },
  {
    icon: 'reminders',
    title: 'Reminders that respect people',
    description:
      'Polite reminders before and after the due date, in your client time zone, with quiet hours and a promise to pay you can record.',
  },
  {
    icon: 'clients',
    title: 'Clients and contacts',
    description:
      'One record per client with contacts, addresses, tax details, documents and the full history of what they owe and have paid.',
  },
  {
    icon: 'expenses',
    title: 'Expenses and receipts',
    description:
      'Photograph a receipt and let it become an expense. Match bank lines automatically and keep every claim with its evidence.',
  },
  {
    icon: 'reports',
    title: 'Reports you can hand over',
    description:
      'Profit and loss, aged receivables, tax summary and sales by client. Every report exports as comma separated values and as a PDF with a total row.',
  },
  {
    icon: 'security',
    title: 'Secure by default',
    description:
      'Two step verification, strict separation between businesses, encrypted credentials and a tamper evident audit trail of every change.',
  },
];

export interface Step {
  title: string;
  description: string;
}

export const HOW_IT_WORKS: readonly Step[] = [
  {
    title: 'Create in seconds',
    description:
      'Pick a client, add lines from your catalogue and the totals, tax and due date are filled in for you.',
  },
  {
    title: 'Send anywhere',
    description:
      'Email the invoice from your own address, or share a secure link your client can open on a phone.',
  },
  {
    title: 'Get paid fast',
    description:
      'Your client pays online, the invoice is marked as paid and the payment lands in your books automatically.',
  },
];

export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQ: readonly FaqEntry[] = [
  {
    question: 'Is there a free plan?',
    answer:
      'Yes. Every account starts on the Free plan, which covers a small number of invoices and clients each month. You can stay on it for as long as you like.',
  },
  {
    question: 'How long is the trial on paid plans?',
    answer:
      'Paid plans include a fourteen day trial. You are not charged until the trial ends, and you can cancel from the billing page at any time.',
  },
  {
    question: 'Which payment methods can my clients use?',
    answer:
      'Cards and digital wallets through our global payout partners, bank transfer, and local payment methods via licensed partners in your country. You can also record cash and cheque payments yourself.',
  },
  {
    question: 'Do my clients need an account to pay?',
    answer:
      'No. A client opens a secure link, reads the invoice and pays. There is nothing to sign up for and nothing to install.',
  },
  {
    question: 'Can reminders be sent automatically?',
    answer:
      'Yes. You choose how many days before and after the due date a reminder goes out, and the schedule respects your client time zone and your quiet hours.',
  },
  {
    question: 'Who can see my invoices?',
    answer:
      'Only you, the team members you invite and the clients you send a document to. Each business is isolated at the database level, not just in the interface.',
  },
  {
    question: 'Can my accountant have access?',
    answer:
      'Yes. Invite your accountant with one click. They see the books and can post journal entries, and you can revoke the access whenever you want.',
  },
  {
    question: 'Is my data safe?',
    answer:
      'Credentials are encrypted, every change is written to a tamper evident audit trail, backups run daily and you can export everything you have at any time.',
  },
  {
    question: 'Can I use my own domain and logo?',
    answer:
      'Yes. Upload your logo and set your brand colour, and on the higher plans you can serve the client portal from your own domain.',
  },
  {
    question: 'Is there an API?',
    answer:
      'Yes. There is a documented REST interface with API keys, scoped permissions, webhooks and a developer portal, plus Zapier and Make connectors.',
  },
  {
    question: 'What happens to my invoices if I cancel?',
    answer:
      'Nothing is deleted when you cancel. Your account becomes read only and you can export every invoice, client and payment as comma separated values or PDF.',
  },
  {
    question: 'How do I get help?',
    answer: `Write to ${BRAND.supportEmail} and a person answers. Support is included on every plan, including the free one.`,
  },
];

export const CLOSING_CTA = {
  title: 'Start billing better today',
  description:
    'Create your first invoice in about a minute. No card needed, and your data stays yours.',
  primaryCta: { label: 'Create a free account', href: ROUTES.register },
  secondaryCta: { label: 'Talk to us', href: ROUTES.contact },
} as const;

export interface FooterSection {
  title: string;
  links: readonly NavLink[];
}

export const FOOTER_SECTIONS: readonly FooterSection[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: ROUTES.features },
      { label: 'Pricing', href: ROUTES.pricing },
      { label: 'Create an account', href: ROUTES.register },
      { label: 'For developers', href: ROUTES.developerDocs },
      { label: 'Sign in', href: ROUTES.login },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact', href: ROUTES.contact },
      { label: 'Support', href: `mailto:${BRAND.supportEmail}` },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of service', href: ROUTES.termsOfService },
      { label: 'Privacy policy', href: ROUTES.privacyPolicy },
      { label: 'Cookie policy', href: ROUTES.cookiePolicy },
    ],
  },
];
