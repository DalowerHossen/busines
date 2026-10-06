// src/features/messaging/queries/list-routes.ts
// Reading the fallback chains a business can use, with the channels each one
// tries and how many conversations are walking down it right now.

import type { MessageRouteRecord, RouteStepRecord } from '@/features/messaging/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readJson, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import { isJsonObject } from '@/types/json';

export interface RouteListResult {
  routes: readonly MessageRouteRecord[];
  /** True when the list could not be read. */
  isDegraded: boolean;
}

/**
 * Maps the steps stored with one chain.
 *
 * @param row Row returned by the database routine.
 * @returns The steps in the order they are tried.
 */
function toSteps(row: DatabaseRow): readonly RouteStepRecord[] {
  const raw = readJson(row, 'steps');
  const list = Array.isArray(raw) ? raw : [];

  return list.filter(isJsonObject).map((entry, index) => ({
    stepOrder: typeof entry.step_order === 'number' ? entry.step_order : index + 1,
    channel: typeof entry.channel === 'string' ? entry.channel : 'email',
    templateKey: typeof entry.template_key === 'string' ? entry.template_key : null,
    waitMinutes: typeof entry.wait_minutes === 'number' ? entry.wait_minutes : 60,
    isRequired: entry.is_required === true,
    maxAttempts: typeof entry.max_attempts === 'number' ? entry.max_attempts : 1,
  }));
}

/**
 * Reads the fallback chains of one business.
 *
 * @param companyId Business whose chains are being read.
 * @returns The chains, and whether the read failed.
 */
export async function loadMessageRoutes(companyId: string): Promise<RouteListResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('company_message_routes', {
    p_company_id: companyId,
  });

  if (error) {
    logger.error('The fallback chains could not be read', error, { companyId });

    return { routes: [], isDegraded: true };
  }

  const routes = asRows(data).map((row) => ({
    routeId: readString(row, 'route_id') ?? '',
    routeKey: readString(row, 'route_key') ?? '',
    name: readString(row, 'name') ?? '',
    description: readString(row, 'description'),
    isPlatformRoute: readBoolean(row, 'is_platform_route') ?? false,
    isActive: readBoolean(row, 'is_active') ?? false,
    stopOnDelivery: readBoolean(row, 'stop_on_delivery') ?? true,
    stopOnEngagement: readBoolean(row, 'stop_on_engagement') ?? true,
    respectQuietHours: readBoolean(row, 'respect_quiet_hours') ?? true,
    requiresConsent: readBoolean(row, 'requires_consent') ?? true,
    steps: toSteps(row),
    runningCount: readNumber(row, 'running_count') ?? 0,
  }));

  return { routes, isDegraded: false };
}
