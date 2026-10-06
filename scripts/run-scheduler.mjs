// scripts/run-scheduler.mjs
// The scheduler for a self hosted installation.
//
// Managed hosts have their own way of running something every few minutes.
// A server you own does not, so this does the same job: it wakes up, calls
// the scheduled routes with the shared secret, and writes down what
// happened. It holds no business logic of its own, so a scheduled run and a
// run somebody triggers by hand during an incident are identical.

import process from 'node:process';

/** The routes to call, and how often in minutes. */
const TASKS = [
  { task: 'dispatch-messages', everyMinutes: 5 },
  { task: 'deliver-webhooks', everyMinutes: 2 },
  { task: 'release-funds', everyMinutes: 60 },
  { task: 'read-receipts', everyMinutes: 15 },
];

const baseUrl = (
  process.env.SCHEDULER_BASE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');

const secret = process.env.CRON_SECRET ?? '';

if (secret === '') {
  console.error('CRON_SECRET is not set, so the scheduler cannot authenticate itself.');
  process.exit(1);
}

/**
 * Calls one scheduled route and reports what it said.
 *
 * @param {string} task Name of the route under /api/cron.
 * @returns {Promise<void>}
 */
async function run(task) {
  const startedAt = Date.now();

  try {
    const response = await fetch(`${baseUrl}/api/cron/${task}`, {
      method: 'POST',
      headers: { 'x-cron-secret': secret },
      signal: AbortSignal.timeout(120000),
    });

    const duration = Date.now() - startedAt;

    console.log(
      JSON.stringify({
        task,
        status: response.status,
        ok: response.ok,
        durationMs: duration,
        at: new Date().toISOString(),
      })
    );
  } catch (cause) {
    console.error(
      JSON.stringify({
        task,
        error: cause instanceof Error ? cause.message : 'unknown',
        at: new Date().toISOString(),
      })
    );
  }
}

console.log(`The scheduler is running against ${baseUrl}.`);

for (const entry of TASKS) {
  // Run once at startup so a fresh deployment does not wait an hour for its
  // first release of matured funds.
  void run(entry.task);

  setInterval(() => {
    void run(entry.task);
  }, entry.everyMinutes * 60000);
}
