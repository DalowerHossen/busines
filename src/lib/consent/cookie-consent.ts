// src/lib/consent/cookie-consent.ts
// The cookie consent record, shared by the banner in the browser and by the
// server that stores the decision. Nothing here touches the database, so both
// sides can import it.

/** Categories a visitor can be asked about. */
export type ConsentCategory = 'necessary' | 'analytics' | 'marketing' | 'preferences';

export interface ConsentDecision {
  /** Always true: these cookies are required for the service to work. */
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  /** Version of the cookie policy the visitor was shown. */
  version: string;
}

/** Name of the cookie holding the decision. */
export const CONSENT_COOKIE_NAME = 'kd_cookie_consent';

/** Name of the cookie holding the anonymous visitor identifier. */
export const VISITOR_COOKIE_NAME = 'kd_visitor';

/** Version of the published cookie policy. */
export const CONSENT_POLICY_VERSION = '2026-01-01';

/** How long a decision is honoured before the visitor is asked again. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const DENY_ALL_CONSENT: ConsentDecision = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
  version: CONSENT_POLICY_VERSION,
};

export const ALLOW_ALL_CONSENT: ConsentDecision = {
  necessary: true,
  analytics: true,
  marketing: true,
  preferences: true,
  version: CONSENT_POLICY_VERSION,
};

export interface ConsentCategoryDescription {
  category: Exclude<ConsentCategory, 'necessary'> | 'necessary';
  title: string;
  description: string;
  /** True when the visitor cannot switch the category off. */
  isLocked: boolean;
}

export const CONSENT_CATEGORIES: readonly ConsentCategoryDescription[] = [
  {
    category: 'necessary',
    title: 'Strictly necessary',
    description:
      'Keeps you signed in, protects forms from being forged and remembers this choice. The service cannot run without them.',
    isLocked: true,
  },
  {
    category: 'preferences',
    title: 'Preferences',
    description:
      'Remembers how you like the interface: the business you were in, your table layout and the guides you have dismissed.',
    isLocked: false,
  },
  {
    category: 'analytics',
    title: 'Analytics',
    description:
      'Counts page views and product events so we can see what is used and what is confusing. Never the contents of your invoices.',
    isLocked: false,
  },
  {
    category: 'marketing',
    title: 'Marketing',
    description:
      'Measures which campaign brought you here, so we stop paying for advertising that does not help anybody.',
    isLocked: false,
  },
];

/**
 * Writes a decision into the compact form stored in the cookie.
 *
 * @param decision Decision to encode.
 * @returns The cookie value.
 */
export function encodeConsent(decision: ConsentDecision): string {
  const flags = [
    `v:${decision.version}`,
    `a:${decision.analytics ? 1 : 0}`,
    `m:${decision.marketing ? 1 : 0}`,
    `p:${decision.preferences ? 1 : 0}`,
  ];

  return flags.join('|');
}

/**
 * Reads a decision back out of a cookie value.
 *
 * @param value Cookie value, or null when the cookie is absent.
 * @returns The decision, or null when nothing valid was stored.
 */
export function decodeConsent(value: string | null | undefined): ConsentDecision | null {
  if (!value) {
    return null;
  }

  const parts = new Map<string, string>();

  for (const piece of value.split('|')) {
    const separator = piece.indexOf(':');

    if (separator > 0) {
      parts.set(piece.slice(0, separator), piece.slice(separator + 1));
    }
  }

  const version = parts.get('v');

  if (!version) {
    return null;
  }

  return {
    necessary: true,
    analytics: parts.get('a') === '1',
    marketing: parts.get('m') === '1',
    preferences: parts.get('p') === '1',
    version,
  };
}

/**
 * Reports whether a stored decision still answers the current policy.
 *
 * @param decision Decision read from the cookie.
 * @returns True when the visitor does not need to be asked again.
 */
export function isConsentCurrent(decision: ConsentDecision | null): boolean {
  return decision !== null && decision.version === CONSENT_POLICY_VERSION;
}

/**
 * Answers whether a category may load for this decision.
 *
 * @param decision Decision read from the cookie, if any.
 * @param category Category being considered.
 * @returns True when the category is allowed.
 */
export function consentAllows(
  decision: ConsentDecision | null,
  category: ConsentCategory
): boolean {
  if (category === 'necessary') {
    return true;
  }

  if (!isConsentCurrent(decision) || decision === null) {
    return false;
  }

  return decision[category];
}
