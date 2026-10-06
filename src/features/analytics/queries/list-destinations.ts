// src/features/analytics/queries/list-destinations.ts
// Reading where this website reports its measurement.

import type { ActiveDestination, MeasurementDestination } from '@/features/analytics/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export interface DestinationBoard {
  destinations: readonly MeasurementDestination[];
  /** True when the list could not be read. */
  isDegraded: boolean;
}

/**
 * Reads every destination for the console.
 *
 * @returns The destinations and whether the read failed.
 */
export async function loadDestinations(): Promise<DestinationBoard> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('analytics_destination_list');

  if (error) {
    logger.error('The measurement destinations could not be read', error);

    return { destinations: [], isDegraded: true };
  }

  return {
    destinations: asRows(data).map((row) => ({
      destinationId: readString(row, 'destination_id') ?? '',
      providerKey: readString(row, 'provider_key') ?? '',
      label: readString(row, 'label') ?? '',
      publicIdentifier: readString(row, 'public_identifier') ?? '',
      consentCategory: readString(row, 'consent_category') ?? 'analytics',
      isEnabled: readBoolean(row, 'is_enabled'),
      loadsOnMarketingPages: readBoolean(row, 'loads_on_marketing_pages'),
      loadsOnApplicationPages: readBoolean(row, 'loads_on_application_pages'),
      hasAccessToken: readBoolean(row, 'has_access_token'),
      tokenHint: readString(row, 'token_hint'),
      notes: readString(row, 'notes'),
      updatedAt: readString(row, 'updated_at') ?? '',
    })),
    isDegraded: false,
  };
}

/**
 * Reads what one kind of page may load.
 *
 * Nothing here is secret: these identifiers appear in the page source of
 * every website that uses them. What matters is that each arrives with the
 * consent category it may only load under.
 *
 * @param surface Either the marketing pages or the application pages.
 * @returns The identifiers that page may load.
 */
export async function loadActiveDestinations(
  surface: 'marketing' | 'application'
): Promise<readonly ActiveDestination[]> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase.rpc('active_analytics_destinations', {
    p_surface: surface,
  });

  if (error) {
    logger.warn('The measurement identifiers could not be read', { message: error.message });

    return [];
  }

  return asRows(data).map((row) => ({
    providerKey: readString(row, 'provider_key') ?? '',
    publicIdentifier: readString(row, 'public_identifier') ?? '',
    consentCategory: readString(row, 'consent_category') ?? 'analytics',
  }));
}
