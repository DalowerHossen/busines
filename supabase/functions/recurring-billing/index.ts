// Recurring invoice and expense worker for Supabase Cron.
// Each schedule row is claimed with FOR UPDATE SKIP LOCKED in PostgreSQL;
// retries use the idempotency key recorded by the database.
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
    const key = idempotencyKey(request, 'recurring-billing');
    const client = createAdminClient();
    const { data, error } = await client.rpc('run_recurring_billing', {
      p_idempotency_key: key,
      p_as_of: asOf,
    });

    if (error) {
      console.error('Recurring billing RPC failed', { code: error.code });
      return jsonResponse({ error: 'Recurring billing failed' }, 500);
    }
    if (data?.status === 'failed') {
      console.error('Recurring billing recorded a failure', {
        idempotencyKey: key,
      });
      return jsonResponse({ error: 'Recurring billing failed', result: data }, 500);
    }
    return jsonResponse({ ok: true, result: data });
  } catch (error) {
    console.error('Recurring billing request failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonResponse({ error: 'Recurring billing failed' }, 500);
  }
});
