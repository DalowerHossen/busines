// src/features/platform/actions/plan-domains.ts
// Writing out every hostname and DNS record this installation needs.
//
// One domain is typed in; everything else is derived. The person configuring
// DNS then has the complete list in front of them rather than a help article
// and a guess.

'use server';

import { revalidatePath } from 'next/cache';

import { planDomainsSchema } from '@/features/platform/validation/platform';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { buildDomainPlans } from '@/lib/platform/dns-records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/json';

export interface PlanDomainsResult {
  /** How many hostnames were written down. */
  hostnameCount: number;
}

export const planPlatformDomains = createAction(
  planDomainsSchema,
  async (input): Promise<PlanDomainsResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();
    const plans = buildDomainPlans(input.rootDomain, input.hostTarget);

    for (const plan of plans) {
      const records: Json = plan.records.map((record) => ({
        type: record.type,
        name: record.name,
        value: record.value,
        purpose: record.purpose,
        is_required: record.isRequired,
      }));

      const { error } = await supabase.rpc('save_platform_domain', {
        p_purpose: plan.purpose,
        p_hostname: plan.hostname,
        p_expected_records: records,
        p_is_primary: true,
        p_notes: null,
      });

      if (error) {
        logger.error('A hostname could not be written down', error, {
          hostname: plan.hostname,
        });

        throw new AppError('database_failure', 'The domain list could not be saved.');
      }
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'platform_domain',
      entityId: null,
      description: `Domain plan written for ${input.rootDomain}.`,
      metadata: { root_domain: input.rootDomain, host_target: input.hostTarget },
    });

    revalidatePath('/admin/platform');

    return { hostnameCount: plans.length };
  },
  { name: 'planPlatformDomains' }
);
