import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  CircleDollarSign,
  FileCheck2,
  Globe2,
  Layers3,
  LockKeyhole,
  Sparkles,
  UsersRound,
  Zap,
} from 'lucide-react';

export interface MarketingFeature {
  readonly icon: LucideIcon;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly bullets: readonly string[];
}

export const MARKETING_FEATURES: readonly MarketingFeature[] = [
  {
    icon: FileCheck2,
    eyebrow: 'Invoice without friction',
    title: 'A clear path from draft to paid.',
    description:
      'Keep clients, line items, documents, and payment context together so every invoice feels considered.',
    bullets: [
      'Frozen company and client snapshots',
      'Payment links with tokenized client access',
      'Installments, notes, and audit-ready history',
    ],
  },
  {
    icon: CircleDollarSign,
    eyebrow: 'Payment clarity',
    title: 'Know what moved and why.',
    description:
      'Bring payments, fees, refunds, disputes, and payout context into one operational view.',
    bullets: [
      'Provider-neutral gateway contracts',
      'Decimal-safe amounts and versioned rules',
      'Retry-safe payment and payout boundaries',
    ],
  },
  {
    icon: UsersRound,
    eyebrow: 'Team rhythm',
    title: 'Give every role the right view.',
    description:
      'Role-aware navigation and tenant boundaries keep owners, staff, accountants, affiliates, and platform teams focused.',
    bullets: [
      'Company-scoped workspaces',
      'Permission-aware workflows',
      'Read-only support and impersonation safeguards',
    ],
  },
  {
    icon: BarChart3,
    eyebrow: 'Business signal',
    title: 'Turn activity into next steps.',
    description:
      'See the revenue, due amounts, expenses, and work waiting for attention without losing the detail behind each number.',
    bullets: [
      'Reports with accounting context',
      'Searchable client and invoice history',
      'Export-ready operational records',
    ],
  },
  {
    icon: Globe2,
    eyebrow: 'Built for the real world',
    title: 'Work across currencies and channels.',
    description:
      'Keep local payment methods, global providers, messaging, and ecommerce connections behind consistent internal contracts.',
    bullets: [
      'Multi-currency foundations',
      'Consent-aware communication',
      'Commerce order normalization',
    ],
  },
  {
    icon: LockKeyhole,
    eyebrow: 'Trust by design',
    title: 'Make the safe path the easy path.',
    description:
      'Security, tenant isolation, consent evidence, and server-side authorization are part of the product foundation.',
    bullets: [
      'Strict input validation',
      'Configurable retention and compliance rules',
      'No raw card data in the platform',
    ],
  },
];

export const FAQ_ITEMS = [
  {
    question: 'Can I start on a free plan?',
    answer:
      'Yes. New workspaces start with the Free plan selected during onboarding. Plan limits and live pricing remain configurable by the platform team.',
  },
  {
    question: 'Do clients need an account?',
    answer:
      'No. Clients can use signed, expiring document links. Optional email OTP can add a verification step without creating a client login.',
  },
  {
    question: 'Can my staff see every company action?',
    answer:
      'No. Company membership and fine-grained capabilities determine which workspaces and actions appear. The server remains the final authorization boundary.',
  },
  {
    question: 'How are payment fees handled?',
    answer:
      'The fee engine uses trusted gateway metadata to classify card tiers automatically. Versioned platform and company rules can be changed independently by authorized administrators.',
  },
  {
    question: 'Where are uploaded files stored?',
    answer:
      'The application uses a provider-neutral storage contract with Google Drive as the default platform provider. The browser never receives provider credentials.',
  },
  {
    question: 'Can I connect an ecommerce store?',
    answer:
      'The merchant flow supports a hosted, provider-neutral integration boundary for supported ecommerce platforms. Provider adapters are kept behind official contracts.',
  },
];

export const PLAN_PREVIEWS = [
  {
    name: 'Free',
    tone: 'A focused start',
    description: 'Core invoicing and client workflows for a small operation.',
    highlights: ['10 clients', '10 invoices per month', 'One staff seat'],
  },
  {
    name: 'Starter',
    tone: 'A little more room',
    description: 'More capacity for a growing client list and team.',
    highlights: ['100 clients', '100 invoices per month', 'Three staff seats'],
  },
  {
    name: 'Professional',
    tone: 'More operating range',
    description: 'For teams ready to connect more of the business.',
    highlights: ['1,000 clients', 'API access', 'Multi-currency support'],
  },
  {
    name: 'Business',
    tone: 'A broader workspace',
    description: 'Higher limits for established, multi-person teams.',
    highlights: ['Unlimited clients', '25 staff seats', 'Expanded messaging limits'],
  },
];

export const MERCHANT_STEPS = [
  {
    number: '01',
    icon: Sparkles,
    title: 'Register',
    description:
      'Create a workspace, choose a starting plan, and tell us how your business operates.',
  },
  {
    number: '02',
    icon: LockKeyhole,
    title: 'Complete manual KYC',
    description:
      'Submit the required business information when your chosen settlement path needs verification.',
  },
  {
    number: '03',
    icon: Layers3,
    title: 'Integrate',
    description:
      'Use a hosted checkout, API key, or ready-made connection through the documented platform boundary.',
  },
  {
    number: '04',
    icon: Zap,
    title: 'Go live',
    description:
      'Review your settings, test the flow, and start collecting payments with auditable records.',
  },
];

export const CUSTOMER_STORIES = [
  {
    label: 'Service teams',
    quote: 'The best billing workflow is the one that makes the next action obvious.',
    detail: 'A focused workspace for proposals, invoices, reminders, and payment context.',
  },
  {
    label: 'Growing operators',
    quote: 'Your team should see the work they own, not a maze of settings.',
    detail: 'Role-aware navigation and company-scoped context keep daily work calm.',
  },
  {
    label: 'Digital merchants',
    quote: 'Integrations should expand your workflow without taking it over.',
    detail:
      'Provider-neutral contracts keep commerce, messaging, and payment connections replaceable.',
  },
];
