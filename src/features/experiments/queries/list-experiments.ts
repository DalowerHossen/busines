// src/features/experiments/queries/list-experiments.ts
// Reading the tests running on the public site.

import type { ExperimentRow, VariantRow } from '@/features/experiments/types';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ExperimentBoard {
  experiments: readonly ExperimentRow[];
  /** The sides of each test, keyed by the test they belong to. */
  variants: Readonly<Record<string, readonly VariantRow[]>>;
  /** True when the read failed. */
  isDegraded: boolean;
}

/**
 * Reads every test and the sides of each one.
 *
 * @returns The tests, their variants and whether the read failed.
 */
export async function loadExperimentBoard(): Promise<ExperimentBoard> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('experiment_list');

  if (error) {
    logger.error('The tests could not be read', error);

    return { experiments: [], variants: {}, isDegraded: true };
  }

  const experiments = asRows(data).map((row) => ({
    experimentId: readString(row, 'experiment_id') ?? '',
    key: readString(row, 'key') ?? '',
    name: readString(row, 'name') ?? '',
    hypothesis: readString(row, 'hypothesis'),
    goalEventName: readString(row, 'goal_event_name') ?? '',
    surface: readString(row, 'surface') ?? 'landing_page',
    status: readString(row, 'status') ?? 'draft',
    trafficPercentage: readNumber(row, 'traffic_percentage') ?? 100,
    variantCount: readNumber(row, 'variant_count') ?? 0,
    totalAssignments: readNumber(row, 'total_assignments') ?? 0,
    totalConversions: readNumber(row, 'total_conversions') ?? 0,
    startedAt: readString(row, 'started_at'),
    conclusion: readString(row, 'conclusion'),
  }));

  const variants: Record<string, readonly VariantRow[]> = {};

  await Promise.all(
    experiments.map(async (experiment) => {
      const { data: rows, error: variantError } = await supabase.rpc('experiment_variant_list', {
        p_experiment_id: experiment.experimentId,
      });

      if (variantError) {
        return;
      }

      variants[experiment.experimentId] = asRows(rows).map((row) => ({
        variantId: readString(row, 'variant_id') ?? '',
        key: readString(row, 'key') ?? '',
        name: readString(row, 'name') ?? '',
        isControl: readBoolean(row, 'is_control'),
        weight: readNumber(row, 'weight') ?? 50,
        assignmentCount: readNumber(row, 'assignment_count') ?? 0,
        conversionCount: readNumber(row, 'conversion_count') ?? 0,
        conversionRate: readAmount(row, 'conversion_rate'),
      }));
    })
  );

  return { experiments, variants, isDegraded: false };
}
