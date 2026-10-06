// Shared authorization for scheduled Supabase Edge functions.
// Cron endpoints accept one server-only secret and never accept a browser
// session or a user-supplied service-role token.

const encoder = new TextEncoder();

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export async function isAuthorizedCronRequest(request: Request): Promise<boolean> {
  const expected = Deno.env.get('CRON_SECRET');
  const received = request.headers.get('x-cron-secret');
  if (!expected || !received) {
    return false;
  }
  return constantTimeEqual(await digest(expected), await digest(received));
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export function idempotencyKey(request: Request, jobName: string): string {
  const supplied = request.headers.get('x-idempotency-key')?.trim();
  if (supplied) {
    return supplied.slice(0, 200);
  }
  const hour = new Date().toISOString().slice(0, 13);
  return `${jobName}:${hour}`;
}
