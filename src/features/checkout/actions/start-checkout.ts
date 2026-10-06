// src/features/checkout/actions/start-checkout.ts
// Starting an online payment from a client link.
//
// The caller has no account, so the token is the only credential and the work
// runs with the service role. The attempt is written down before the provider
// is called, which is what lets a lost browser be reconciled afterwards by the
// webhook rather than the payment being lost.

'use server';

import { resolveCheckoutLink } from '@/features/checkout/queries/get-checkout';
import { startCheckoutSchema } from '@/features/checkout/validation/checkout';
import { createAction } from '@/lib/actions/create-action';
import { decryptCredentialBundle } from '@/lib/crypto/encryption';
import { sha256Hex } from '@/lib/crypto/hashing';
import { absoluteUrl } from '@/lib/env/env.client';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { toMinorUnits } from '@/lib/money';
import { adapterFor } from '@/lib/payments/adapters/registry';
import { asRow, readAmount, readEnum, readJson, readString } from '@/lib/records';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { getRequestContext } from '@/lib/security/request-context';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { GATEWAY_MODES, GATEWAY_PROVIDERS } from '@/types/enums';

export interface StartCheckoutResult {
  /** Where the client should be sent, or null when they stay here. */
  checkoutUrl: string | null;
  /** What to tell the client when there is nowhere to send them. */
  instructions: string | null;
}

export const startCheckout = createAction(
  startCheckoutSchema,
  async (input): Promise<StartCheckoutResult> => {
    const context = getRequestContext();

    const decision = await consumeRateLimit({
      kind: 'checkout_start',
      key: sha256Hex(`${input.token}:${context.ipAddress ?? 'unknown'}`),
      limit: 10,
      windowSeconds: 300,
    });

    if (!decision.isAllowed) {
      throw new AppError(
        'rate_limited',
        'That is a lot of attempts in a short time. Wait a minute and try again.'
      );
    }

    const link = await resolveCheckoutLink(input.token);

    if (link === null) {
      throw new AppError('not_found', 'This payment link cannot be opened any more.');
    }

    const supabase = getServiceSupabaseClient();

    const [invoiceResult, gatewayResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, client_id, currency, currency_exponent, balance_due, invoice_number, status')
        .eq('id', link.invoiceId)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('payment_gateways')
        .select('id, provider, mode, credentials_encrypted, adapter_config, is_enabled')
        .eq('id', input.gatewayId)
        .eq('company_id', link.companyId)
        .is('deleted_at', null)
        .maybeSingle(),
    ]);

    const invoice = asRow(invoiceResult.data);
    const gateway = asRow(gatewayResult.data);

    if (invoice === null) {
      throw new AppError('not_found', 'This invoice is not available any more.');
    }

    if (gateway === null || gateway['is_enabled'] !== true) {
      throw new AppError('not_found', 'That way of paying is not available on this invoice.');
    }

    const balanceDue = readAmount(invoice, 'balance_due');

    if (Number.parseFloat(balanceDue) <= 0) {
      throw new AppError('conflict', 'This invoice has already been paid in full.');
    }

    const currency = readString(invoice, 'currency') ?? 'USD';
    const number = readString(invoice, 'invoice_number') ?? 'Invoice';
    const amountMinor = toMinorUnits(balanceDue, currency);
    const idempotencyKey = sha256Hex(`${link.invoiceId}:${input.gatewayId}:${balanceDue}`).slice(
      0,
      48
    );

    // What the payer agreed to is written down before the provider is even
    // called. A dispute is decided on documents, and this is the document.
    const { error: consentError } = await supabase.rpc('record_checkout_consent', {
      p_invoice_id: link.invoiceId,
      p_consent_statement: input.consentStatement,
      p_ip_address: context.ipAddress,
      p_ip_hash: context.ipHash,
      p_user_agent: context.userAgent,
      p_accept_language: input.acceptLanguage ?? null,
      p_time_zone: input.timeZone ?? null,
      p_screen_fingerprint: input.screenFingerprint ?? null,
      p_document_link_id: link.linkId,
      p_payment_intent_id: null,
      p_viewed_seconds: input.viewedSeconds ?? null,
      p_terms_version: null,
      p_terms_hash: null,
    });

    if (consentError) {
      logger.error('The payer agreement could not be recorded', consentError, {
        companyId: link.companyId,
      });

      throw new AppError(
        'database_failure',
        'This payment could not be started. Try again in a moment.'
      );
    }

    const { data: intentData, error: intentError } = await supabase
      .from('payment_intents')
      .upsert(
        {
          company_id: link.companyId,
          client_id: readString(invoice, 'client_id'),
          invoice_id: link.invoiceId,
          provider: readString(gateway, 'provider'),
          gateway_id: input.gatewayId,
          mode: readString(gateway, 'mode'),
          amount: balanceDue,
          amount_minor: amountMinor,
          currency,
          currency_exponent: Number.parseInt(String(invoice['currency_exponent'] ?? 2), 10),
          status: 'pending',
          idempotency_key: idempotencyKey,
          client_ip: context.ipAddress,
          client_user_agent: context.userAgent,
        },
        { onConflict: 'company_id,idempotency_key' }
      )
      .select('id')
      .single();

    const intent = asRow(intentData);

    if (intentError || intent === null) {
      logger.error('A payment attempt could not be written down', intentError, {
        companyId: link.companyId,
      });

      throw new AppError(
        'database_failure',
        'This payment could not be started. Please try again.'
      );
    }

    const intentId = readString(intent, 'id') ?? '';
    const envelope = readString(gateway, 'credentials_encrypted');
    let credentials: Record<string, string> = {};

    if (envelope) {
      try {
        credentials = decryptCredentialBundle(envelope);
      } catch (caught) {
        logger.error('Stored gateway credentials could not be read', caught, {
          companyId: link.companyId,
        });

        throw new AppError('unexpected', 'This payment method is not ready. Try another one.');
      }
    }

    const provider = readEnum(gateway, 'provider', GATEWAY_PROVIDERS, 'manual');
    const returnUrl = absoluteUrl(`/pay/${encodeURIComponent(input.token)}/result`);

    try {
      const start = await adapterFor(provider).startCheckout(
        {
          provider,
          mode: readEnum(gateway, 'mode', GATEWAY_MODES, 'test'),
          credentials,
          adapterConfig: readJson(gateway, 'adapter_config'),
        },
        {
          intentId,
          amount: balanceDue,
          amountMinor,
          currency,
          description: number,
          returnUrl,
          payerEmail: link.recipientEmail,
        }
      );

      await supabase
        .from('payment_intents')
        .update({
          provider_intent_reference: start.providerReference,
          checkout_url: start.checkoutUrl,
          return_url: returnUrl,
        })
        .eq('id', intentId);

      await supabase
        .from('payment_gateways')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', input.gatewayId);

      return { checkoutUrl: start.checkoutUrl, instructions: start.instructions };
    } catch (caught) {
      await supabase.rpc('fail_payment_intent', {
        p_intent_id: intentId,
        p_failure_code: 'checkout_not_started',
        p_failure_message: 'The provider would not open a payment page.',
      });

      await supabase
        .from('payment_gateways')
        .update({
          last_error_at: new Date().toISOString(),
          last_error_message: 'A payment could not be started.',
        })
        .eq('id', input.gatewayId);

      throw caught;
    }
  },
  { name: 'startCheckout' }
);
