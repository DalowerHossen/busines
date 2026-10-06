// src/lib/supabase/realtime.ts
// Tenant-scoped Realtime subscriptions. RLS remains authoritative; the
// company_id filter prevents accidental cross-tenant subscription requests and
// rejects channel/filter injection before it reaches Supabase.
'use client';

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from './client';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;

export interface TenantRealtimeEvent {
  readonly event: 'INSERT' | 'UPDATE' | 'DELETE';
  readonly table: string;
  readonly newRecord: Readonly<Record<string, unknown>>;
  readonly oldRecord: Readonly<Record<string, unknown>>;
}

export function subscribeToCompanyChanges(input: {
  readonly companyId: string;
  readonly tables: readonly string[];
  readonly onEvent: (event: TenantRealtimeEvent) => void;
  readonly client?: SupabaseClient;
  readonly channelName?: string;
}): { readonly channel: RealtimeChannel; readonly unsubscribe: () => Promise<void> } {
  if (!UUID_PATTERN.test(input.companyId)) {
    throw new Error('A valid company identifier is required for Realtime subscriptions.');
  }
  if (input.tables.length === 0 || input.tables.some((table) => !IDENTIFIER_PATTERN.test(table))) {
    throw new Error('Realtime table names must be safe lowercase identifiers.');
  }

  const client: SupabaseClient = input.client ?? getBrowserSupabaseClient();
  const channelName = input.channelName ?? `company:${input.companyId}`;
  if (!/^company:[0-9a-f-]{36}$/iu.test(channelName)) {
    throw new Error('Realtime channel name must be company-scoped.');
  }

  let channel = client.channel(channelName);
  for (const table of input.tables) {
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `company_id=eq.${input.companyId}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        input.onEvent({
          event: payload.eventType as TenantRealtimeEvent['event'],
          table,
          newRecord: asRecord(payload.new),
          oldRecord: asRecord(payload.old),
        });
      }
    );
  }
  channel.subscribe();
  return {
    channel,
    unsubscribe: async () => {
      await client.removeChannel(channel);
    },
  };
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Readonly<Record<string, unknown>>;
}
