// Retention and privacy queue worker for Supabase Cron.
// Provider-backed export, Auth deletion, and backup creation remain behind
// their configured adapters; this worker only performs safe database state
// transitions and records failures durably.
import { createAdminClient } from '../_shared/supabase.ts';
import { idempotencyKey, isAuthorizedCronRequest, jsonResponse } from '../_shared/auth.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  if (!(await isAuthorizedCronRequest(request))) {
    return jsonResponse({ error: 'Unauthorized scheduled request' }, 401);
  }

  try {
    const key = idempotencyKey(request, 'data-retention');
    const client = createAdminClient();
    const { data, error } = await client.rpc('run_data_retention_jobs', {
      p_idempotency_key: key,
      p_as_of: new Date().toISOString(),
    });

    if (error) {
      console.error('Data retention RPC failed', { code: error.code });
      return jsonResponse({ error: 'Data retention failed' }, 500);
    }
    if (data?.status === 'failed') {
      console.error('Data retention recorded a failure', { idempotencyKey: key });
      return jsonResponse({ error: 'Data retention failed', result: data }, 500);
    }
    return jsonResponse({ ok: true, result: data });
  } catch (error) {
    console.error('Data retention request failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonResponse({ error: 'Data retention failed' }, 500);
  }
});
