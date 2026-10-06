// netlify/functions/shared-runner.mjs
// Calling one of the scheduled routes of the application.
//
// The scheduled functions deliberately hold no business logic. They exist
// only to wake up and knock on a door that a person can also knock on
// during an incident, which means the scheduled path and the manual path
// are never subtly different.

/**
 * Calls one scheduled route with the shared secret.
 *
 * @param {string} task Name of the route under /api/cron.
 * @returns {Promise<Response>} What the route answered.
 */
export async function runScheduledTask(task) {
  const base = process.env.URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '';
  const secret = process.env.CRON_SECRET ?? '';

  if (base === '' || secret === '') {
    return new Response('The scheduler is not configured on this deployment.', { status: 500 });
  }

  const response = await fetch(`${base.replace(/\/+$/, '')}/api/cron/${task}`, {
    method: 'POST',
    headers: { 'x-cron-secret': secret },
  });

  return new Response(await response.text(), { status: response.status });
}
