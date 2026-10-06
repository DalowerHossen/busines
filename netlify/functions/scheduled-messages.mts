// netlify/functions/scheduled-messages.mts
// Sends the messages that are due. The work itself lives in the application
// route, so the same thing can be run by hand during an incident.

import { runScheduledTask } from './shared-runner.mjs';

/**
 * Wakes up every few minutes and sends whatever is due.
 *
 * @returns Nothing of consequence; the log carries the outcome.
 */
export default async function handler(): Promise<Response> {
  return runScheduledTask('dispatch-messages');
}
