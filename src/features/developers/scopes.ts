// src/features/developers/scopes.ts
// The permissions an application can ask an account for.
//
// A scope is written as resource and action, so a grant can be read in one
// line by the person giving it. Nothing in the interface invents a scope:
// everything comes from this list.

export interface ApiScope {
  /** Value stored on the grant, for example invoices:read. */
  key: string;
  /** Plain sentence shown on the consent screen. */
  label: string;
  /** What the application can and cannot do with it. */
  description: string;
  /** True when the scope lets the application change something. */
  isWrite: boolean;
}

export const API_SCOPES: readonly ApiScope[] = [
  {
    key: 'invoices:read',
    label: 'Read your invoices',
    description: 'See invoice numbers, totals, due dates and whether they are paid.',
    isWrite: false,
  },
  {
    key: 'invoices:write',
    label: 'Create and change invoices',
    description: 'Draft new invoices and update ones that have not been issued.',
    isWrite: true,
  },
  {
    key: 'clients:read',
    label: 'Read your clients',
    description: 'See client names, contact details and balances.',
    isWrite: false,
  },
  {
    key: 'clients:write',
    label: 'Create and change clients',
    description: 'Add clients and keep their details up to date.',
    isWrite: true,
  },
  {
    key: 'payments:read',
    label: 'Read your payments',
    description: 'See payments received, their method and their fees.',
    isWrite: false,
  },
  {
    key: 'payments:write',
    label: 'Record payments',
    description: 'Record a payment against an invoice on your behalf.',
    isWrite: true,
  },
  {
    key: 'products:read',
    label: 'Read your items',
    description: 'See the products and services on your price list.',
    isWrite: false,
  },
  {
    key: 'expenses:read',
    label: 'Read your expenses',
    description: 'See recorded expenses and their categories.',
    isWrite: false,
  },
  {
    key: 'reports:read',
    label: 'Read your reports',
    description: 'See the totals behind the reporting pages.',
    isWrite: false,
  },
];

/** Every scope value, for validation. */
export const API_SCOPE_KEYS: readonly string[] = API_SCOPES.map((scope) => scope.key);

/**
 * Describes one scope.
 *
 * @param key Scope value stored on the grant.
 * @returns The description, or a readable fallback.
 */
export function describeScope(key: string): ApiScope {
  const found = API_SCOPES.find((scope) => scope.key === key);

  if (found) {
    return found;
  }

  return {
    key,
    label: key,
    description: 'A permission this application asked for.',
    isWrite: key.endsWith(':write'),
  };
}
