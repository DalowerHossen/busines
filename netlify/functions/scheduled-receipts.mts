// netlify/functions/scheduled-receipts.mts
// Reads the receipts people have photographed.

import { runScheduledTask } from './shared-runner.mjs';

/**
 * Wakes up every quarter of an hour and reads what is waiting.
 *
 * @returns Nothing of consequence; the log carries the outcome.
 */
export default async function handler(): Promise<Response> {
  return runScheduledTask('read-receipts');
}

// Netlify only treats a function as scheduled when it exports this config,
// so without it the handler above would never be invoked automatically.
export const config = {
  schedule: '*/15 * * * *',
};
