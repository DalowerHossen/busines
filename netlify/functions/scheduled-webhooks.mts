// netlify/functions/scheduled-webhooks.mts
// Delivers the events a business asked to be told about.

import { runScheduledTask } from './shared-runner.mjs';

/**
 * Wakes up every couple of minutes and attempts the due deliveries.
 *
 * @returns Nothing of consequence; the log carries the outcome.
 */
export default async function handler(): Promise<Response> {
  return runScheduledTask('deliver-webhooks');
}

// Netlify only treats a function as scheduled when it exports this config,
// so without it the handler above would never be invoked automatically.
export const config = {
  schedule: '*/5 * * * *',
};
