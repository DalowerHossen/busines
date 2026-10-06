// src/lib/logger.ts
// Structured logging. Every line is one JSON object so a log drain can index
// it, and nothing that looks like a secret is ever written out.
//
// A failure also leaves for the reporting service, because a log line is
// read when somebody goes looking and a report arrives by itself.

import { reportFailure } from '@/lib/observability/report';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: string | number | boolean | null | undefined;
}

const LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED_KEY_PATTERN =
  /(password|secret|token|api[_-]?key|authorization|cookie|signature|private[_-]?key)/i;

const REDACTED_VALUE = '[redacted]';

/**
 * Decides the lowest level that is written, based on the environment.
 *
 * @returns The minimum level to emit.
 */
function minimumLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL;

  if (
    configured === 'debug' ||
    configured === 'info' ||
    configured === 'warn' ||
    configured === 'error'
  ) {
    return configured;
  }

  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

/**
 * Replaces the value of any field whose name suggests a secret.
 *
 * @param context Fields supplied by the caller.
 * @returns A copy safe to write to a log.
 */
function redact(context: LogContext): LogContext {
  const safe: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    safe[key] = REDACTED_KEY_PATTERN.test(key) ? REDACTED_VALUE : value;
  }

  return safe;
}

/**
 * Writes one structured line.
 *
 * @param level Severity of the entry.
 * @param message Short description of what happened.
 * @param context Extra fields to attach.
 * @returns Nothing.
 */
function write(level: LogLevel, message: string, context: LogContext = {}): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minimumLevel()]) {
    return;
  }

  const line = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...redact(context),
  });

  if (level === 'error') {
    console.error(line);
    return;
  }

  console.warn(line);
}

export const logger = {
  /**
   * Writes a line that is only useful while developing.
   *
   * @param message Short description.
   * @param context Extra fields.
   * @returns Nothing.
   */
  debug(message: string, context?: LogContext): void {
    write('debug', message, context);
  },

  /**
   * Writes a line describing normal progress.
   *
   * @param message Short description.
   * @param context Extra fields.
   * @returns Nothing.
   */
  info(message: string, context?: LogContext): void {
    write('info', message, context);
  },

  /**
   * Writes a line about something unexpected that was handled.
   *
   * @param message Short description.
   * @param context Extra fields.
   * @returns Nothing.
   */
  warn(message: string, context?: LogContext): void {
    write('warn', message, context);
  },

  /**
   * Writes a line about a failure, including the error if one was caught.
   *
   * @param message Short description.
   * @param caught Value caught in a try block.
   * @param context Extra fields.
   * @returns Nothing.
   */
  error(message: string, caught?: unknown, context?: LogContext): void {
    const details: LogContext = { ...context };

    if (caught instanceof Error) {
      details.errorName = caught.name;
      details.errorMessage = caught.message;
    } else if (caught !== undefined) {
      details.errorMessage = String(caught);
    }

    write('error', message, details);
    reportFailure(message, caught, details);
  },
};
