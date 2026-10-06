// src/config/brand.ts
// The single source of truth for how the product presents itself.

export const BRAND = {
  name: 'KD SOLUTION IT',
  shortName: 'KD',
  tagline: 'Smart Billing for Modern Business',
  description:
    'Invoicing, billing and subscriptions for modern businesses. Send professional invoices, collect payments online and keep every client account in one place.',
  legalName: 'KD SOLUTION IT',
  supportEmail: 'support@kdsolutionit.com',
  salesEmail: 'support@kdsolutionit.com',
  noticeEmail: 'support@kdsolutionit.com',
  primaryDomain: 'kdsolutionit.com',
  colors: {
    primary: '#1d4ed8',
    primaryDark: '#1e40af',
    primaryLight: '#3b82f6',
    accent: '#0f172a',
    success: '#15803d',
    warning: '#b45309',
    danger: '#b91c1c',
    muted: '#64748b',
  },
  social: {
    facebook: 'https://www.facebook.com/kdsolutionit',
    linkedin: 'https://www.linkedin.com/company/kdsolutionit',
    x: 'https://x.com/kdsolutionit',
    youtube: 'https://www.youtube.com/@kdsolutionit',
  },
} as const;

export type BrandColorName = keyof typeof BRAND.colors;

/** Layer order for anything that floats above the page. */
export const Z_INDEX = {
  base: 0,
  sticky: 40,
  overlay: 60,
  modal: 70,
  dropdown: 75,
  toast: 80,
} as const;

/** Sender identity used for every message the platform sends itself. */
export const PLATFORM_SENDER = {
  fromName: BRAND.name,
  fromAddress: BRAND.supportEmail,
  replyTo: BRAND.supportEmail,
} as const;
