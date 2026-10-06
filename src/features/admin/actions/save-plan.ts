// src/features/admin/actions/save-plan.ts
// Creating or revising a plan the platform sells. Limits and modules are
// typed as plain lines, which keeps the form readable and the document
// flexible as new limits are introduced.

'use server';

import { revalidatePath } from 'next/cache';

import { savePlanSchema } from '@/features/admin/validation/catalogue';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/json';

export interface SavePlanResult {
  /** Identifier of the plan that was written. */
  planId: string;
}

/**
 * Reads the limit lines into a document.
 *
 * @param raw Lines typed in the console, one per limit.
 * @returns The limits document, where null means unlimited.
 */
function parseLimits(raw: string): Record<string, Json> {
  const limits: Record<string, Json> = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    const [key, value] = trimmed.split('=').map((part) => part.trim());

    if (!key || value === undefined) {
      throw new AppError('validation_failed', `Write each limit as key=value, not "${trimmed}".`, {
        fieldErrors: { limits: [`Write each limit as key=value, not "${trimmed}".`] },
      });
    }

    if (value.toLowerCase() === 'unlimited' || value.toLowerCase() === 'null') {
      limits[key] = null;
      continue;
    }

    const parsed = Number.parseInt(value, 10);

    if (Number.isNaN(parsed)) {
      throw new AppError('validation_failed', `The limit "${key}" needs a number or unlimited.`, {
        fieldErrors: { limits: [`The limit "${key}" needs a number or unlimited.`] },
      });
    }

    limits[key] = parsed;
  }

  return limits;
}

/**
 * Reads the module lines into a document.
 *
 * @param raw Lines typed in the console, one per module.
 * @returns The features document.
 */
function parseFeatures(raw: string): Record<string, Json> {
  const features: Record<string, Json> = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    const [key, value] = trimmed.split('=').map((part) => part.trim());

    if (!key || value === undefined) {
      throw new AppError(
        'validation_failed',
        `Write each module as key=true or key=false, not "${trimmed}".`,
        { fieldErrors: { features: [`Write each module as key=true or key=false.`] } }
      );
    }

    features[key] = value.toLowerCase() === 'true';
  }

  return features;
}

export const savePlan = createAction(
  savePlanSchema,
  async (input): Promise<SavePlanResult> => {
    await requireSuperAdmin();

    const limits = parseLimits(input.limits);
    const features = parseFeatures(input.features);
    const supabase = createServerSupabaseClient();

    const payload = {
      plan_key: input.planKey,
      name: input.name,
      tagline: input.tagline,
      description: input.description,
      badge_label: input.badgeLabel,
      is_free: input.isFree,
      is_public: input.isPublic,
      is_archived: input.isArchived,
      trial_days: input.trialDays,
      display_order: input.displayOrder,
      merchant_of_record_fee_percentage: input.merchantFeePercentage,
      merchant_of_record_fee_fixed: input.merchantFeeFixed,
      limits,
      features,
    };

    if (input.planId) {
      const { error } = await supabase
        .from('subscription_plans')
        .update(payload)
        .eq('id', input.planId);

      if (error) {
        logger.error('A plan could not be saved', error, { planId: input.planId });

        throw new AppError('database_failure', 'That plan was not saved. Please try again.');
      }

      await recordAuditEntry({
        action: 'update',
        entityType: 'subscription_plan',
        entityId: input.planId,
        companyId: null,
        description: `Plan ${input.planKey} revised.`,
      });

      revalidatePath('/admin/plans');

      return { planId: input.planId };
    }

    const { data, error } = await supabase
      .from('subscription_plans')
      .insert(payload)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('A plan could not be created', error, { planKey: input.planKey });

      throw new AppError(
        'database_failure',
        'That plan was not created. The key may already be in use.'
      );
    }

    const created = asRow(data);
    const planId = created === null ? '' : (readString(created, 'id') ?? '');

    await recordAuditEntry({
      action: 'insert',
      entityType: 'subscription_plan',
      entityId: planId,
      companyId: null,
      description: `Plan ${input.planKey} created.`,
    });

    revalidatePath('/admin/plans');

    return { planId };
  },
  { name: 'savePlan' }
);
