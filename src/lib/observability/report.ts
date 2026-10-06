// src/lib/observability/report.ts
// Sending a failure somewhere a person will see it.
//
// A log line in a hosting dashboard is read when somebody goes looking. An
// error report arrives. The difference matters at two in the morning, and
// it matters more for the failures nobody noticed because the page still
// rendered something.
//
// This talks to the reporting service directly over its public ingest
// protocol rather than through its software development kit. The kit is
// several megabytes, instruments everything, and would need its own build
// step; what is actually needed is one well formed request. Fewer moving
// parts also means the reporting cannot take the application down with it.

export interface ReportContext {
  [key: string]: string | number | boolean | null | undefined;
}

interface IngestTarget {
  url: string;
  key: string;
  projectId: string;
}

/** Fields whose value is never sent anywhere, whatever a caller passes. */
const SECRET_PATTERN =
  /(password|secret|token|api[_-]?key|authorization|cookie|signature|private[_-]?key)/i;

/** How many reports may leave this process in a minute. */
const REPORTS_PER_MINUTE = 30;

let windowStartedAt = 0;
let reportsInWindow = 0;

/**
 * Reads the address of the reporting service out of its connection string.
 *
 * @returns Where to post, or null when reporting is not configured.
 */
function ingestTarget(): IngestTarget | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';

  if (dsn === '') {
    return null;
  }

  try {
    const parsed = new URL(dsn);
    const projectId = parsed.pathname.replace(/^\/+/, '');

    if (projectId === '' || parsed.username === '') {
      return null;
    }

    return {
      url: `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`,
      key: parsed.username,
      projectId,
    };
  } catch {
    return null;
  }
}

/**
 * Reports whether this process has already sent enough for one minute.
 *
 * A failure that happens in a loop should not turn into a second outage in
 * the reporting service, nor into a bill.
 *
 * @returns True when the report should be dropped.
 */
function isOverTheLimit(): boolean {
  const now = Date.now();

  if (now - windowStartedAt > 60000) {
    windowStartedAt = now;
    reportsInWindow = 0;
  }

  reportsInWindow += 1;

  return reportsInWindow > REPORTS_PER_MINUTE;
}

/**
 * Removes anything that looks like a secret from the context.
 *
 * @param context Fields supplied by the caller.
 * @returns A copy safe to send to a third party.
 */
function scrub(context: ReportContext): ReportContext {
  const safe: ReportContext = {};

  for (const [key, value] of Object.entries(context)) {
    safe[key] = SECRET_PATTERN.test(key) ? '[redacted]' : value;
  }

  return safe;
}

/**
 * Sends one failure to the reporting service.
 *
 * Deliberately returns nothing and never throws. Reporting a problem must
 * not be able to cause one, so every failure here is swallowed: the log
 * line has already been written by the caller.
 *
 * @param message What went wrong, in the words of whoever caught it.
 * @param caught The value caught in the try block, if there was one.
 * @param context Extra fields worth having beside the failure.
 * @returns Nothing.
 */
export function reportFailure(
  message: string,
  caught?: unknown,
  context: ReportContext = {}
): void {
  // The browser has its own reporting path and no service role; this is for
  // the server, where the failures that matter actually happen.
  if (typeof window !== 'undefined') {
    return;
  }

  const target = ingestTarget();

  if (target === null || isOverTheLimit()) {
    return;
  }

  const error = caught instanceof Error ? caught : null;
  const eventId = globalThis.crypto.randomUUID().replace(/-/g, '');
  const sentAt = new Date().toISOString();

  const event = {
    event_id: eventId,
    timestamp: sentAt,
    platform: 'node',
    level: 'error',
    logger: 'application',
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
    release: process.env.RELEASE_VERSION ?? process.env.npm_package_version ?? '0.0.0',
    message: { formatted: message },
    exception:
      error === null
        ? undefined
        : {
            values: [
              {
                type: error.name,
                value: error.message,
                stacktrace: { frames: [] },
              },
            ],
          },
    extra: scrub(context),
  };

  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: sentAt }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');

  void fetch(target.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-sentry-envelope',
      'x-sentry-auth': `Sentry sentry_version=7, sentry_client=kd-platform/1.0, sentry_key=${target.key}`,
    },
    body: envelope,
    signal: AbortSignal.timeout(4000),
  }).catch(() => {
    // Nothing to do. The failure is already in the log, and a reporting
    // service that is down must not become a second incident.
  });
}
