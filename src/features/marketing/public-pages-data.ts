import {
  BarChart3,
  CheckCircle2,
  FileText,
  Globe2,
  LockKeyhole,
  Mail,
  MessageCircle,
  ShieldCheck,
  UsersRound,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PublicBlogPost {
  readonly slug: string;
  readonly category: string;
  readonly title: string;
  readonly excerpt: string;
  readonly readTime: string;
  readonly accent: 'brand' | 'dark' | 'warm';
}

export const PUBLIC_BLOG_POSTS: readonly PublicBlogPost[] = [
  {
    slug: 'billing-rhythm',
    category: 'Operations',
    title: 'Build a billing rhythm your team can trust',
    excerpt:
      'A practical way to connect client context, invoice detail, and the next action without adding another maze of screens.',
    readTime: '6 min read',
    accent: 'brand',
  },
  {
    slug: 'payment-records',
    category: 'Payments',
    title: 'What an accountable payment record should answer',
    excerpt:
      'From authorization to payout, the useful record is the one that keeps context close to every decision.',
    readTime: '8 min read',
    accent: 'dark',
  },
  {
    slug: 'merchant-launch',
    category: 'Ecommerce',
    title: 'A calmer checklist for a merchant launch',
    excerpt:
      'Registration, manual review, integration, and go-live are four different moments. Treating them that way makes launches clearer.',
    readTime: '5 min read',
    accent: 'warm',
  },
];

export interface PublicStatusService {
  readonly name: string;
  readonly detail: string;
  readonly status: 'Operational' | 'Maintenance window';
}

export const PUBLIC_STATUS_SERVICES: readonly PublicStatusService[] = [
  {
    name: 'Application',
    detail: 'Public pages and authenticated workspace access',
    status: 'Operational',
  },
  {
    name: 'Document links',
    detail: 'Tokenized client access and document delivery',
    status: 'Operational',
  },
  { name: 'Payment processing', detail: 'Gateway and settlement handoff', status: 'Operational' },
  {
    name: 'File storage',
    detail: 'Private attachments and generated documents',
    status: 'Operational',
  },
];

export interface ApiResourcePreview {
  readonly icon: LucideIcon;
  readonly name: string;
  readonly description: string;
  readonly methods: readonly string[];
}

export const API_RESOURCE_PREVIEWS: readonly ApiResourcePreview[] = [
  {
    icon: FileText,
    name: 'Invoices',
    description: 'Create, read, and track billing documents within a company boundary.',
    methods: ['List', 'Create', 'Get'],
  },
  {
    icon: UsersRound,
    name: 'Clients',
    description: 'Keep client records, access links, and communication context together.',
    methods: ['List', 'Create', 'Update'],
  },
  {
    icon: BarChart3,
    name: 'Reports',
    description: 'Request business summaries with the same tenant-scoped rules as the workspace.',
    methods: ['Sales', 'Aging', 'Export'],
  },
  {
    icon: MessageCircle,
    name: 'Webhooks',
    description: 'Receive signed event notifications with delivery history and retry policy.',
    methods: ['Subscribe', 'Verify', 'Replay'],
  },
];

export const SECURITY_PRINCIPLES = [
  {
    icon: LockKeyhole,
    title: 'Server-owned secrets',
    text: 'Provider credentials and signing keys stay behind server-side boundaries.',
  },
  {
    icon: ShieldCheck,
    title: 'Evidence by default',
    text: 'Important payment, delivery, and consent events are designed to remain auditable.',
  },
  {
    icon: Globe2,
    title: 'Tenant-aware context',
    text: 'Company scope is part of the data model and authorization plan, not a UI afterthought.',
  },
];

export const ACCESSIBILITY_PRACTICES = [
  'Keyboard-operable navigation, dialogs, forms, and accordion content',
  'Visible focus treatment and semantic headings for page structure',
  '44 pixel minimum interactive targets across touch layouts',
  'Reduced-motion support and readable color contrast as design constraints',
];

export const GUIDE_STEPS = [
  {
    icon: UsersRound,
    label: 'Start with context',
    text: 'Keep the company, client, and work in front of the person making the decision.',
  },
  {
    icon: FileText,
    label: 'Make the record useful',
    text: 'A document should explain what happened, what is due, and what to do next.',
  },
  {
    icon: Zap,
    label: 'Automate the repeatable',
    text: 'Use reminders, channels, and integrations only after the underlying record is clear.',
  },
];

export const CONTACT_PATHS = [
  {
    icon: Mail,
    title: 'General questions',
    detail: 'For product, plan, or partnership questions.',
    action: 'support@kdsolutionit.com',
    href: 'mailto:support@kdsolutionit.com',
  },
  {
    icon: MessageCircle,
    title: 'Workspace support',
    detail: 'Sign in first when your question includes private company or billing data.',
    action: 'Open your workspace',
    href: '/login',
  },
  {
    icon: ShieldCheck,
    title: 'Security reports',
    detail: 'Share responsible disclosure details with the security contact.',
    action: 'security@kdsolutionit.com',
    href: 'mailto:security@kdsolutionit.com',
  },
] as const;

export const ABOUT_VALUES = [
  {
    icon: CheckCircle2,
    title: 'Clarity over clutter',
    text: 'Every surface should help a person understand the next useful action.',
  },
  {
    icon: UsersRound,
    title: 'Context for every role',
    text: 'Owners, staff, accountants, and platform operators need different views of the same truth.',
  },
  {
    icon: Globe2,
    title: 'Ready for real operations',
    text: 'Currencies, channels, gateways, and compliance boundaries should be replaceable without losing the record.',
  },
];
