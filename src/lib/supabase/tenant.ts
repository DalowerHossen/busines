// src/lib/supabase/tenant.ts
// Server-side authorization guard used before every repository query or
// mutation. RLS remains the final database boundary; this check gives route
// handlers a stable, safe failure before constructing a tenant query.
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class TenantAuthorizationError extends Error {
  readonly code = 'tenant_access_denied' as const;

  constructor() {
    super('You are not authorized to access this company.');
    this.name = 'TenantAuthorizationError';
  }
}

export async function assertTenantAccess(
  client: SupabaseClient,
  companyId: string,
  options: { readonly write?: boolean } = {}
): Promise<void> {
  if (!UUID_PATTERN.test(companyId)) throw new TenantAuthorizationError();
  const functionName = options.write
    ? 'current_user_can_write_domain'
    : 'current_user_has_company_access';
  const args = options.write
    ? { p_company_id: companyId, p_domain: 'tenant' }
    : { p_company_id: companyId };
  const { data, error } = await client.rpc(functionName, args);
  if (error || data !== true) throw new TenantAuthorizationError();
}

export function tenantFilter<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  companyId: string
): T {
  if (!UUID_PATTERN.test(companyId)) throw new TenantAuthorizationError();
  return query.eq('company_id', companyId);
}
