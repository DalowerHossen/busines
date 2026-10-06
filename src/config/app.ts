// src/config/app.ts
// Application wide behaviour that is not a secret and not tenant specific.

/** Paths that the interface links to from more than one place. */
export const ROUTES = {
  home: '/',
  features: '/features',
  pricing: '/pricing',
  contact: '/contact',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  twoFactor: '/two-factor',
  dashboard: '/dashboard',
  setup: '/dashboard/setup',
  invoices: '/dashboard/invoices',
  estimates: '/dashboard/estimates',
  clients: '/dashboard/clients',
  products: '/dashboard/products',
  payments: '/dashboard/payments',
  payouts: '/dashboard/payouts',
  billing: '/dashboard/billing',
  subscriptions: '/dashboard/subscriptions',
  expenses: '/dashboard/expenses',
  reports: '/dashboard/reports',
  banking: '/dashboard/banking',
  projects: '/dashboard/projects',
  marketing: '/dashboard/marketing/campaigns',
  contracts: '/dashboard/contracts',
  loyalty: '/dashboard/loyalty',
  files: '/dashboard/files',
  settings: '/dashboard/settings',
  team: '/dashboard/team',
  messages: '/dashboard/messages',
  marketplace: '/dashboard/marketplace',
  developers: '/dashboard/developers',
  connectedApps: '/dashboard/settings/connected-apps',
  developerDocs: '/developers',
  admin: '/admin',
  reseller: '/reseller',
  accountant: '/accountant',
  affiliate: '/affiliate',
  clientPortal: '/d',
  clientCheckout: '/pay',
  clientSigning: '/sign',
  privacyPolicy: '/privacy-policy',
  cookiePolicy: '/cookie-policy',
  termsOfService: '/terms-of-service',
} as const;

export type RouteName = keyof typeof ROUTES;

/** Page sizes offered by every table in the interface. */
export const PAGE_SIZES = [10, 25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 25;

export const MAX_PAGE_SIZE = 200;

/** Limits applied to uploads before a file ever reaches storage. */
export const UPLOAD_LIMITS = {
  logoBytes: 2 * 1024 * 1024,
  avatarBytes: 1 * 1024 * 1024,
  attachmentBytes: 25 * 1024 * 1024,
  receiptBytes: 10 * 1024 * 1024,
  kycDocumentBytes: 10 * 1024 * 1024,
  importBytes: 50 * 1024 * 1024,
} as const;

export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
] as const;

export const ACCEPTED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

/** How long cached runtime configuration may be served before it is refreshed. */
export const CACHE_TTL_SECONDS = {
  integrationCredentials: 5,
  platformSettings: 15,
  featureFlags: 15,
  companyProfile: 30,
  publicContent: 300,
} as const;

/** Session behaviour defaults; a tenant may tighten these in its security policy. */
export const SESSION_DEFAULTS = {
  idleTimeoutMinutes: 60,
  absoluteTimeoutHours: 24,
  rememberMeDays: 30,
  twoFactorWindowSeconds: 30,
} as const;

/** Window used by the default request rate limit. */
export const RATE_LIMIT_DEFAULTS = {
  windowSeconds: 60,
  maxRequests: 120,
  burstRequests: 30,
} as const;

/** Breakpoints the interface is designed and tested against, in pixels. */
export const BREAKPOINTS = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1920,
} as const;

/** Smallest interactive target accepted by the design review, in pixels. */
export const MIN_TOUCH_TARGET_PX = 44;
