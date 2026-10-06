// src/features/platform/queries/get-operations.ts
// What the operations console shows: readiness, domains, health and the
// settings that can be changed while the platform runs.

import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type Json } from '@/types/json';

export interface ReadinessStep {
  key: string;
  title: string;
  detail: string;
  href: string;
  isDone: boolean;
  isRequired: boolean;
}

export interface DomainRecord {
  type: string;
  name: string;
  value: string;
  purpose: string;
  isRequired: boolean;
}

export interface PlatformDomain {
  domainId: string;
  purpose: string;
  hostname: string;
  records: readonly DomainRecord[];
  failingRecords: readonly string[];
  isVerified: boolean;
  isPrimary: boolean;
  lastCheckedAt: string | null;
  lastCheckMessage: string | null;
  notes: string | null;
}

export interface HealthEntry {
  checkedAt: string;
  isHealthy: boolean;
  databaseMs: number | null;
  storageOk: boolean | null;
  emailOk: boolean | null;
  releaseVersion: string | null;
}

export interface JobFailure {
  failureId: string;
  jobName: string;
  entityType: string;
  companyName: string | null;
  reason: string;
  occurredAt: string;
}

export interface PlatformSetting {
  settingKey: string;
  settingGroup: string;
  label: string;
  description: string | null;
  value: string;
  valueType: string;
  isSecret: boolean;
}

export interface OperationsBoard {
  requiredCount: number;
  requiredDone: number;
  isReady: boolean;
  steps: readonly ReadinessStep[];
  domains: readonly PlatformDomain[];
  health: readonly HealthEntry[];
  settings: readonly PlatformSetting[];
  /** Work a scheduled job skipped and nobody has dealt with. */
  jobFailures: readonly JobFailure[];
  /** True when something could not be read. */
  isDegraded: boolean;
}

const EMPTY: OperationsBoard = {
  requiredCount: 0,
  requiredDone: 0,
  isReady: false,
  steps: [],
  domains: [],
  health: [],
  settings: [],
  jobFailures: [],
  isDegraded: false,
};

/**
 * Turns a stored json value into something a text field can hold.
 *
 * @param value The stored value.
 * @returns The value as a string.
 */
function toText(value: Json | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Reads everything the operations console shows.
 *
 * @returns Readiness, domains, health and settings.
 */
export async function loadOperationsBoard(): Promise<OperationsBoard> {
  const supabase = createServerSupabaseClient();

  const [readiness, domains, health, settings, failures] = await Promise.all([
    supabase.rpc('platform_readiness'),
    supabase.rpc('platform_domain_list'),
    supabase.rpc('recent_health_checks', { p_limit: 10 }),
    supabase
      .from('platform_settings')
      .select('setting_key, setting_group, label, description, value, value_type, is_secret')
      .order('setting_group', { ascending: true })
      .order('setting_key', { ascending: true }),
    supabase.rpc('recent_job_failures', { p_limit: 20 }),
  ]);

  const failure = readiness.error ?? domains.error ?? health.error ?? settings.error;

  if (failure) {
    logger.error('The operations console could not be read', failure);

    return { ...EMPTY, isDegraded: true };
  }

  const state = isJsonObject(readiness.data) ? readiness.data : {};
  const rawSteps = Array.isArray(state['steps']) ? state['steps'] : [];

  return {
    requiredCount: typeof state['required_count'] === 'number' ? state['required_count'] : 0,
    requiredDone: typeof state['required_done'] === 'number' ? state['required_done'] : 0,
    isReady: state['is_ready'] === true,
    steps: rawSteps.flatMap((entry) => {
      if (!isJsonObject(entry)) {
        return [];
      }

      return [
        {
          key: typeof entry['key'] === 'string' ? entry['key'] : '',
          title: typeof entry['title'] === 'string' ? entry['title'] : '',
          detail: typeof entry['detail'] === 'string' ? entry['detail'] : '',
          href: typeof entry['href'] === 'string' ? entry['href'] : '/admin',
          isDone: entry['is_done'] === true,
          isRequired: entry['is_required'] === true,
        },
      ];
    }),
    domains: asRows(domains.data).map((row) => {
      const expected = row['expected_records'];
      const failing = row['failing_records'];

      return {
        domainId: readString(row, 'domain_id') ?? '',
        purpose: readString(row, 'purpose') ?? 'app',
        hostname: readString(row, 'hostname') ?? '',
        records: Array.isArray(expected)
          ? expected.flatMap((entry) => {
              if (!isJsonObject(entry)) {
                return [];
              }

              return [
                {
                  type: typeof entry['type'] === 'string' ? entry['type'] : 'TXT',
                  name: typeof entry['name'] === 'string' ? entry['name'] : '',
                  value: typeof entry['value'] === 'string' ? entry['value'] : '',
                  purpose: typeof entry['purpose'] === 'string' ? entry['purpose'] : '',
                  isRequired: entry['isRequired'] === true || entry['is_required'] === true,
                },
              ];
            })
          : [],
        failingRecords: Array.isArray(failing)
          ? failing.filter((entry): entry is string => typeof entry === 'string')
          : [],
        isVerified: readBoolean(row, 'is_verified'),
        isPrimary: readBoolean(row, 'is_primary'),
        lastCheckedAt: readString(row, 'last_checked_at'),
        lastCheckMessage: readString(row, 'last_check_message'),
        notes: readString(row, 'notes'),
      };
    }),
    health: asRows(health.data).map((row) => ({
      checkedAt: readString(row, 'checked_at') ?? '',
      isHealthy: readBoolean(row, 'is_healthy'),
      databaseMs: readNumber(row, 'database_ms'),
      storageOk: row['storage_ok'] === null ? null : readBoolean(row, 'storage_ok'),
      emailOk: row['email_ok'] === null ? null : readBoolean(row, 'email_ok'),
      releaseVersion: readString(row, 'release_version'),
    })),
    jobFailures: asRows(failures.data).map((row) => ({
      failureId: readString(row, 'failure_id') ?? '',
      jobName: readString(row, 'job_name') ?? '',
      entityType: readString(row, 'entity_type') ?? '',
      companyName: readString(row, 'company_name'),
      reason: readString(row, 'reason') ?? '',
      occurredAt: readString(row, 'occurred_at') ?? '',
    })),
    settings: asRows(settings.data).map((row) => ({
      settingKey: readString(row, 'setting_key') ?? '',
      settingGroup: readString(row, 'setting_group') ?? 'general',
      label: readString(row, 'label') ?? '',
      description: readString(row, 'description'),
      value: readBoolean(row, 'is_secret') ? '' : toText(row['value'] as Json),
      valueType: readString(row, 'value_type') ?? 'string',
      isSecret: readBoolean(row, 'is_secret'),
    })),
    isDegraded: false,
  };
}
