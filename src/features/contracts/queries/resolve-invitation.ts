// src/features/contracts/queries/resolve-invitation.ts
// Turning the token in a signing link into the agreement it unlocks.
//
// The signer holds no account, so the read runs with the service role. Every
// rule about expiry and revocation lives in resolve_document_link, and
// nothing is read until that routine has approved the token.

import 'server-only';

import type { SigningInvitation } from '@/features/contracts/types';
import { sha256Hex } from '@/lib/crypto/hashing';
import { asRows, readString } from '@/lib/records';
import { getRequestContext } from '@/lib/security/request-context';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { isJsonObject, type JsonObject } from '@/types/json';

export type InvitationResult =
  | { isAvailable: true; invitation: SigningInvitation }
  | { isAvailable: false; message: string };

/**
 * Explains why a signing link did not open.
 *
 * @param reason Message the database gave, if any.
 * @returns What the visitor is told.
 */
function toFailure(reason: string): InvitationResult {
  if (reason.includes('expired')) {
    return {
      isAvailable: false,
      message: 'This signing link has expired. Ask the sender for a fresh one.',
    };
  }

  if (reason.includes('revoked')) {
    return {
      isAvailable: false,
      message: 'This signing link has been withdrawn by the sender.',
    };
  }

  return {
    isAvailable: false,
    message: 'This signing link is not valid. Check the address in the email you were sent.',
  };
}

/**
 * Reads one text value out of the answer.
 *
 * @param source The invitation as the database returned it.
 * @param key Field being read.
 * @returns The value, or null.
 */
function text(source: JsonObject, key: string): string | null {
  const value = source[key];

  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' ? String(value) : null;
}

/**
 * Opens the agreement behind a signing link.
 *
 * @param token Token taken from the address bar.
 * @returns The invitation, or the reason it cannot be shown.
 */
export async function resolveInvitation(token: string): Promise<InvitationResult> {
  if (token.length < 20 || token.length > 400) {
    return toFailure('not valid');
  }

  const supabase = getServiceSupabaseClient();
  const context = getRequestContext();

  const { data: resolved, error: resolveError } = await supabase.rpc('resolve_document_link', {
    p_token_hash: sha256Hex(token),
    p_ip_address: context.ipAddress,
    p_user_agent: context.userAgent,
  });

  if (resolveError) {
    return toFailure(resolveError.message);
  }

  const link = asRows(resolved)[0];

  if (!link || readString(link, 'document_kind') !== 'contract') {
    return toFailure('not valid');
  }

  const linkId = readString(link, 'link_id') ?? '';

  const { data, error } = await supabase.rpc('contract_for_signing', { p_link_id: linkId });

  if (error || !isJsonObject(data)) {
    return toFailure('not valid');
  }

  const signerId = text(data, 'signer_id') ?? '';

  await supabase.rpc('view_contract', {
    p_signer_id: signerId,
    p_ip_hash: context.ipHash,
    p_user_agent: context.userAgent,
  });

  return {
    isAvailable: true,
    invitation: {
      signerId,
      fullName: text(data, 'full_name') ?? '',
      email: text(data, 'email') ?? '',
      roleLabel: text(data, 'role_label') ?? 'Client',
      signerStatus: text(data, 'signer_status') ?? 'invited',
      signedAt: text(data, 'signed_at'),
      consentText: text(data, 'consent_text'),
      contractId: text(data, 'contract_id') ?? '',
      contractNumber: text(data, 'contract_number') ?? '',
      title: text(data, 'title') ?? '',
      status: text(data, 'status') ?? 'sent',
      bodyHtml: text(data, 'body_html') ?? '',
      currency: text(data, 'currency'),
      contractValue: text(data, 'contract_value'),
      effectiveDate: text(data, 'effective_date'),
      validUntil: text(data, 'valid_until'),
      companyName: text(data, 'company_name'),
      isOpen: data.is_open === true,
      waitingForOthers: data.waiting_for_others === true,
    },
  };
}

/**
 * Finds the party a token belongs to without recording another view.
 *
 * @param token Token taken from the form that was submitted.
 * @returns The identifier of the party, or null.
 */
export async function signerIdForToken(token: string): Promise<string | null> {
  const supabase = getServiceSupabaseClient();

  const { data } = await supabase
    .from('document_links')
    .select('id, document_kind, status')
    .eq('token_hash', sha256Hex(token))
    .maybeSingle();

  const row = data === null ? null : asRows([data])[0];

  if (!row || readString(row, 'document_kind') !== 'contract') {
    return null;
  }

  if (readString(row, 'status') !== 'active') {
    return null;
  }

  const { data: signer } = await supabase
    .from('contract_signers')
    .select('id')
    .eq('document_link_id', readString(row, 'id') ?? '')
    .maybeSingle();

  const signerRow = signer === null ? null : asRows([signer])[0];

  return signerRow ? readString(signerRow, 'id') : null;
}
