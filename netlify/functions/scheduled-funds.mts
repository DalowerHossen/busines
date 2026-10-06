// netlify/functions/scheduled-funds.mts
// Releases the money whose hold window has passed.

import { runScheduledTask } from './shared-runner.mjs';

/**
 * Wakes up hourly and lets matured settlements out of their hold.
 *
 * @returns Nothing of consequence; the log carries the outcome.
 */
export default async function handler(): Promise<Response> {
  return runScheduledTask('release-funds');
}
