// src/lib/messaging/providers/types.ts
// What every messaging provider has to be able to do. Nothing outside this
// folder knows which service is behind a channel, so a business can be moved
// from one supplier to another without a line of application code changing.

import 'server-only';

import type { JsonObject } from '@/types/json';

/** The channels that are not email. */
export type OutboundChannel = 'sms' | 'whatsapp' | 'telegram' | 'viber';

export interface MessagingContext {
  /** Key of the configured provider, as stored on the channel. */
  provider: string;
  /** The channel this sender serves. */
  channel: OutboundChannel;
  /** Credentials in clear text, decrypted for this call only. */
  credentials: Readonly<Record<string, string>>;
  /** Endpoints and field names, for a provider reached by configuration. */
  settings: JsonObject;
  /** The number or handle messages appear to come from. */
  senderAddress: string | null;
}

export interface ChannelTestResult {
  /** True when the provider answered as expected. */
  isHealthy: boolean;
  /** A sentence a business owner can act on. */
  message: string;
}

export interface OutboundChannelMessage {
  /** Where the message is going: a number, a chat identifier or a handle. */
  toAddress: string;
  /** The words themselves. Channels other than email carry text only. */
  bodyText: string;
  /** Identifier of the message in our own records, sent for reconciliation. */
  reference: string;
}

export type ChannelSendOutcome =
  | { status: 'sent'; providerMessageId: string | null }
  | { status: 'failed'; reason: string; isPermanent: boolean }
  | { status: 'not_configured'; reason: string };

export interface MessagingAdapter {
  /** Name used in logs and in the channel list. */
  readonly key: string;
  /**
   * Checks the credentials against the provider without sending anything.
   *
   * @param context Credentials and configuration of the channel.
   * @returns Whether the provider accepted the credentials.
   */
  testConnection(context: MessagingContext): Promise<ChannelTestResult>;
  /**
   * Hands one message to the provider.
   *
   * @param context Credentials and configuration of the channel.
   * @param message The message to send.
   * @returns What the provider did with it.
   */
  send(context: MessagingContext, message: OutboundChannelMessage): Promise<ChannelSendOutcome>;
}

/** How long the platform waits for a provider before giving up. */
export const PROVIDER_TIMEOUT_MS = 12_000;

/**
 * Calls a provider with a timeout, so one slow service cannot hold the worker.
 *
 * @param url Address to call.
 * @param init Request to send.
 * @returns The answer, or a rejection when the provider did not reply in time.
 */
export async function callProvider(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, PROVIDER_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Turns anything a provider threw into a sentence worth storing.
 *
 * @param caught Whatever was thrown.
 * @returns A short description of what went wrong.
 */
export function describeFailure(caught: unknown): string {
  if (caught instanceof Error) {
    return caught.name === 'AbortError' ? 'The provider did not answer in time.' : caught.message;
  }

  return 'The provider could not be reached.';
}

/**
 * Reads one setting of a channel as text.
 *
 * @param settings Configuration stored with the channel.
 * @param key Setting to read.
 * @param fallback Value used when the setting is absent.
 * @returns The setting, or the fallback.
 */
export function readSetting(settings: JsonObject, key: string, fallback: string): string {
  const value = settings[key];

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}
