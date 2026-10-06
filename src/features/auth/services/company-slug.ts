// src/features/auth/services/company-slug.ts
// Turning a business name into the short identifier used in addresses. The
// slug must satisfy the database constraint and must not already be taken.

import 'server-only';

import { randomBytes } from 'node:crypto';

import { slugify } from '@/lib/strings';
import type { ServiceSupabaseClient } from '@/lib/supabase/service';

const MIN_LENGTH = 3;
const MAX_LENGTH = 48;

/**
 * Forces a candidate into the shape the database accepts: lowercase letters,
 * digits and hyphens, beginning and ending with a letter or a digit.
 *
 * @param candidate Text derived from the business name.
 * @returns A usable slug stem.
 */
function normaliseStem(candidate: string): string {
  const base = slugify(candidate).replace(/[^a-z0-9-]/g, '');
  const trimmed = base.replace(/^-+/, '').replace(/-+$/, '').slice(0, MAX_LENGTH);

  if (trimmed.length >= MIN_LENGTH) {
    return trimmed;
  }

  return `${trimmed}${trimmed.length > 0 ? '-' : ''}business`.slice(0, MAX_LENGTH);
}

/**
 * Finds a slug nobody else is using.
 *
 * @param supabase Service client, because the lookup crosses tenants.
 * @param companyName Name the owner typed.
 * @returns A slug that is free at the moment it is returned.
 */
export async function buildUniqueCompanySlug(
  supabase: ServiceSupabaseClient,
  companyName: string
): Promise<string> {
  const stem = normaliseStem(companyName);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${randomBytes(3).toString('hex')}`;
    const candidate = `${stem.slice(0, MAX_LENGTH - suffix.length)}${suffix}`;

    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .eq('slug', candidate)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return candidate;
    }
  }

  return `${stem.slice(0, MAX_LENGTH - 13)}-${randomBytes(6).toString('hex')}`;
}
