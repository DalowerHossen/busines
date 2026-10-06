// Daily/hourly maintenance entry point for Supabase Cron.
// The database function owns locks, idempotency, tenant boundaries, and the
// failure record. This edge handler only authenticates the scheduler and
// passes validated values to the service-role RPC.
import { asDate, createAdminClient } from '../_shared/supabase.ts';
import { idempotencyKey, isAuthorizedCronRequest, jsonResponse } from '../_shared/auth.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  if (!(await isAuthorizedCronRequest(request))) {
    return jsonResponse({ error: 'Unauthorized scheduled request' }, 401);
  }

  try {
    const body = request.headers.get('content-type')?.includes('application/json')
      ? await request.json()
      : {};
    const asOf = asDate(typeof body?.as_of === 'string' ? body.as_of : null);
    const key = idempotencyKey(request, 'scheduled-maintenance');
    const client = createAdminClient();
    const { data, error } = await client.rpc('run_scheduled_maintenance', {
      p_idempotency_key: key,
      p_as_of: asOf,
    });

    if (error) {
      console.error('Scheduled maintenance RPC failed', { code: error.code });
      return jsonResponse({ error: 'Scheduled maintenance failed' }, 500);
    }
    if (data?.status === 'failed') {
      console.error('Scheduled maintenance recorded a failure', {
        idempotencyKey: key,
      });
      return jsonResponse({ error: 'Scheduled maintenance failed', result: data }, 500);
    }
    return jsonResponse({ ok: true, result: data });
  } catch (error) {
    console.error('Scheduled maintenance request failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonResponse({ error: 'Scheduled maintenance failed' }, 500);
  }
});
