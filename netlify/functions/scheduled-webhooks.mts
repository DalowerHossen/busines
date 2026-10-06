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
