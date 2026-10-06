// src/app/api/health/route.ts
// Whether this installation is actually working.
//
// A health endpoint that only proves the web server is alive is worth
// nothing: the web server is almost never the thing that broke. This one
// reaches the database, confirms there is somewhere to store a file and
// something configured to send mail, and reports how long each took. The
// body is deliberately small and says nothing a stranger could use.

import { NextResponse } from 'next/server';

import { HTTP_STATUS } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { releaseInfo } from '@/lib/platform/release';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/** How long any single check may take before it counts as failed. */
const TIMEOUT_MILLISECONDS = 4000;

/**
 * Reports whether the platform is healthy.
 *
 * @returns The health of this installation.
 */
export async function GET(): Promise<NextResponse> {
  const release = releaseInfo();
  const supabase = getServiceSupabaseClient();

  const startedAt = Date.now();
  let databaseOk = false;
  let storageOk = false;
  let emailOk = false;

  try {
    const { error } = await supabase
      .from('platform_settings')
      .select('setting_key')
      .limit(1)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MILLISECONDS));

    databaseOk = !error;
  } catch {
    databaseOk = false;
  }

  const databaseMs = Date.now() - startedAt;

  if (databaseOk) {
    const [storageResult, emailResult] = await Promise.all([
      supabase
        .from('storage_targets')
        .select('id')
        .is('company_id', null)
        .eq('is_active', true)
        .is('deleted_at', null)
        .limit(1),
      supabase
        .from('integration_credentials')
        .select('id')
        .is('company_id', null)
        .in('provider_key', ['resend', 'smtp', 'postmark', 'sendgrid'])
        .eq('is_enabled', true)
        .is('deleted_at', null)
        .limit(1),
    ]);

    storageOk = !storageResult.error && (storageResult.data ?? []).length > 0;
    emailOk = !emailResult.error && (emailResult.data ?? []).length > 0;
  }

  const isHealthy = databaseOk && storageOk;

  if (databaseOk) {
    const { error } = await supabase.rpc('record_health_check', {
      p_is_healthy: isHealthy,
      p_database_ms: databaseMs,
      p_storage_ok: storageOk,
      p_email_ok: emailOk,
      p_release_version: release.version,
      p_detail: { commit: release.commit, environment: release.environment },
    });

    if (error) {
      logger.warn('A health check could not be recorded', { message: error.message });
    }
  }

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      checks: {
        database: databaseOk ? 'ok' : 'failing',
        storage: storageOk ? 'ok' : 'not configured',
        email: emailOk ? 'ok' : 'not configured',
      },
      databaseMs,
      version: release.version,
      commit: release.commit,
      time: new Date().toISOString(),
    },
    {
      status: isHealthy ? HTTP_STATUS.ok : HTTP_STATUS.serverError,
      headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
    }
  );
}
