// src/features/storefronts/queries/list-connections.ts
// Reading the shops wired to one business, and how they are doing.

import type { StorefrontConnection, StorefrontOverview } from '@/features/storefronts/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type JsonObject } from '@/types/json';

export interface StorefrontBoardResult {
  connections: readonly StorefrontConnection[];
  overview: StorefrontOverview;
  /** True when the read failed. */
  isDegraded: boolean;
}

const EMPTY_OVERVIEW: StorefrontOverview = {
  connectionCount: 0,
  liveCount: 0,
  orderCount: 0,
  awaitingPayment: 0,
  collectedAmount: '0',
  isVerified: false,
};

/**
 * Reads a whole number out of the overview.
 *
 * @param source The overview as the database returned it.
 * @param key Field being read.
 * @returns The number, or nothing.
 */
function whole(source: JsonObject, key: string): number {
  const value = source[key];

  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * Reads the shops and the counts in one pass.
 *
 * @param companyId Business whose shops are being read.
 * @returns The shops, the counts and whether the read failed.
 */
export async function loadStorefrontBoard(companyId: string): Promise<StorefrontBoardResult> {
  const supabase = createServerSupabaseClient();

  const [connections, overview] = await Promise.all([
    supabase.rpc('company_storefront_connections', { p_company_id: companyId }),
    supabase.rpc('storefront_overview', { p_company_id: companyId }),
  ]);

  if (connections.error || overview.error) {
    logger.error('The shop connections could not be read', connections.error ?? overview.error, {
      companyId,
    });

    return { connections: [], overview: EMPTY_OVERVIEW, isDegraded: true };
  }

  const counts = isJsonObject(overview.data) ? overview.data : {};
  const collected = counts['collected_amount'];

  return {
    connections: asRows(connections.data).map((row) => ({
      connectionId: readString(row, 'connection_id') ?? '',
      platform: readString(row, 'platform') ?? 'custom',
      storeName: readString(row, 'store_name') ?? '',
      storeDomain: readString(row, 'store_domain') ?? '',
      status: readString(row, 'status') ?? 'pending_verification',
      statusReason: readString(row, 'status_reason'),
      keyMaskedHint: readString(row, 'key_masked_hint'),
      keyIssuedAt: readString(row, 'key_issued_at'),
      notifyUrl: readString(row, 'notify_url'),
      defaultCurrency: readString(row, 'default_currency') ?? 'USD',
      autoIssueInvoice: readBoolean(row, 'auto_issue_invoice'),
      orderCount: readNumber(row, 'order_count') ?? 0,
      paidCount: readNumber(row, 'paid_count') ?? 0,
      lastOrderAt: readString(row, 'last_order_at'),
      lastError: readString(row, 'last_error'),
      lastErrorAt: readString(row, 'last_error_at'),
    })),
    overview: {
      connectionCount: whole(counts, 'connection_count'),
      liveCount: whole(counts, 'live_count'),
      orderCount: whole(counts, 'order_count'),
      awaitingPayment: whole(counts, 'awaiting_payment'),
      collectedAmount:
        typeof collected === 'string'
          ? collected
          : typeof collected === 'number'
            ? String(collected)
            : '0',
      isVerified: counts['is_verified'] === true,
    },
    isDegraded: false,
  };
}
