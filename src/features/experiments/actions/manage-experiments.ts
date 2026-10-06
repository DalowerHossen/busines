// src/features/experiments/actions/manage-experiments.ts
// Writing down a test, starting it, and deciding what it showed.

'use server';

import { revalidatePath } from 'next/cache';

import {
  concludeExperimentSchema,
  experimentIdSchema,
  saveExperimentSchema,
  saveVariantSchema,
} from '@/features/experiments/validation/experiment';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Where the testing screen lives, for cache invalidation. */
const EXPERIMENT_PATH = '/admin/experiments';

export interface ExperimentResult {
  /** Identifier of the test. */
  experimentId: string;
}

export const saveExperiment = createAction(
  saveExperimentSchema,
  async (input): Promise<ExperimentResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_experiment', {
      p_key: input.key,
      p_name: input.name,
      p_goal_event_name: input.goalEventName,
      p_hypothesis: input.hypothesis,
      p_surface: 'landing_page',
      p_traffic_percentage: input.trafficPercentage,
      p_experiment_id: input.experimentId ?? null,
    });

    if (error) {
      logger.error('A test could not be saved', error, { key: input.key });

      throw new AppError(
        'database_failure',
        'That test could not be saved. A running test cannot be rewritten.'
      );
    }

    const experimentId = typeof data === 'string' ? data : null;

    if (experimentId === null) {
      throw new AppError('database_failure', 'It was saved but returned no reference.');
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'experiment',
      entityId: experimentId,
      description: `Test ${input.key} written down.`,
    });

    revalidatePath(EXPERIMENT_PATH);

    return { experimentId };
  },
  { name: 'saveExperiment' }
);

export interface VariantResult {
  /** Identifier of the variant. */
  variantId: string;
}

export const saveExperimentVariant = createAction(
  saveVariantSchema,
  async (input): Promise<VariantResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_experiment_variant', {
      p_experiment_id: input.experimentId,
      p_key: input.key,
      p_name: input.name,
      p_weight: input.weight,
      p_is_control: input.isControl,
      p_overrides: {},
      p_variant_id: input.variantId ?? null,
    });

    if (error) {
      logger.error('A test variant could not be saved', error);

      throw new AppError(
        'database_failure',
        'That side could not be saved. A running test cannot be changed.'
      );
    }

    const variantId = typeof data === 'string' ? data : null;

    if (variantId === null) {
      throw new AppError('database_failure', 'It was saved but returned no reference.');
    }

    revalidatePath(EXPERIMENT_PATH);

    return { variantId };
  },
  { name: 'saveExperimentVariant' }
);

export interface StartResult {
  /** True when visitors are now being split. */
  isRunning: boolean;
}

export const startExperiment = createAction(
  experimentIdSchema,
  async (input): Promise<StartResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('start_experiment', {
      p_experiment_id: input.experimentId,
    });

    if (error) {
      logger.error('A test could not be started', error);

      throw new AppError(
        'database_failure',
        'That test could not be started. Check it has two sides and that they add up to all of the traffic.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'experiment',
      entityId: input.experimentId,
      description: 'Test started on the public site.',
    });

    revalidatePath(EXPERIMENT_PATH);

    return { isRunning: true };
  },
  { name: 'startExperiment' }
);

export interface ConcludeResult {
  /** True when the test is finished and the decision recorded. */
  isConcluded: boolean;
}

export const concludeExperiment = createAction(
  concludeExperimentSchema,
  async (input): Promise<ConcludeResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('conclude_experiment', {
      p_experiment_id: input.experimentId,
      p_winning_variant_id: input.winningVariantId ?? null,
      p_conclusion: input.conclusion,
    });

    if (error) {
      logger.error('A test could not be concluded', error);

      throw new AppError('database_failure', 'That test could not be concluded.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'experiment',
      entityId: input.experimentId,
      description: `Test concluded: ${input.conclusion}.`,
    });

    revalidatePath(EXPERIMENT_PATH);

    return { isConcluded: true };
  },
  { name: 'concludeExperiment' }
);
