// src/features/platform/actions/verify-domain.ts
// Asking the public internet whether the DNS was actually set up.
//
// Trusting somebody's word that they added a record is how mail quietly
// stops working. Every expected record is looked up for real, and whatever
// is missing is named.

'use server';

import { revalidatePath } from 'next/cache';

import { domainIdSchema } from '@/features/platform/validation/platform';
import { createAction } from '@/lib/actions/create-action';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { checkDnsRecord, type DnsRecord } from '@/lib/platform/dns-records';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type Json } from '@/types/json';

export interface VerifyDomainResult {
  /** True when every required record was found. */
  isVerified: boolean;
  /** What is still missing, in the words the console shows. */
  missing: readonly string[];
  /** A sentence to show the person who pressed the button. */
  message: string;
}

export const verifyPlatformDomain = createAction(
  domainIdSchema,
  async (input): Promise<VerifyDomainResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('platform_domains')
      .select('id, hostname, expected_records')
      .eq('id', input.domainId)
      .maybeSingle();

    const domain = asRow(data);

    if (error || domain === null) {
      throw new AppError('not_found', 'That hostname is not one we know about.');
    }

    const expected = domain['expected_records'];
    const records: DnsRecord[] = Array.isArray(expected)
      ? expected.flatMap((entry) => {
          if (!isJsonObject(entry)) {
            return [];
          }

          const type = typeof entry['type'] === 'string' ? entry['type'] : 'TXT';

          if (
            type !== 'A' &&
            type !== 'AAAA' &&
            type !== 'CNAME' &&
            type !== 'TXT' &&
            type !== 'MX'
          ) {
            return [];
          }

          return [
            {
              type,
              name: typeof entry['name'] === 'string' ? entry['name'] : '',
              value: typeof entry['value'] === 'string' ? entry['value'] : '',
              purpose: typeof entry['purpose'] === 'string' ? entry['purpose'] : '',
              isRequired: entry['is_required'] === true,
            },
          ];
        })
      : [];

    if (records.length === 0) {
      throw new AppError(
        'validation_failed',
        'No records are written down for this hostname yet. Write the plan out first.'
      );
    }

    const checks = await Promise.all(records.map((record) => checkDnsRecord(record)));
    const missing = checks
      .filter((check) => check.record.isRequired && !check.isPresent)
      .map((check) => `${check.record.type} ${check.record.name}`);

    const isVerified = missing.length === 0;
    const message = isVerified
      ? 'Every required record is in place.'
      : `${String(missing.length)} required records were not found in DNS yet. They can take an hour to appear.`;

    const failing: Json = missing;

    const { error: recordError } = await supabase.rpc('record_domain_check', {
      p_domain_id: input.domainId,
      p_is_verified: isVerified,
      p_message: message,
      p_failing_records: failing,
    });

    if (recordError) {
      logger.error('A domain check could not be stored', recordError, {
        hostname: readString(domain, 'hostname'),
      });
    }

    revalidatePath('/admin/platform');

    return { isVerified, missing, message };
  },
  { name: 'verifyPlatformDomain' }
);
