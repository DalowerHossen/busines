// src/features/contracts/queries/get-contract.ts
// Reading one agreement with its parties and its trail.

import type {
  ContractDetailRecord,
  ContractEventRecord,
  ContractSignerRecord,
} from '@/features/contracts/types';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type Json, type JsonObject } from '@/types/json';

/**
 * Reads one text value out of the answer.
 *
 * @param source The agreement as the database returned it.
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
 * Reads a whole number out of the answer.
 *
 * @param source The agreement as the database returned it.
 * @param key Field being read.
 * @returns The number, or nothing.
 */
function whole(source: JsonObject, key: string): number {
  const value = source[key];

  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * Maps the parties to the agreement.
 *
 * @param value The parties as the database returned them.
 * @returns The parties in signing order.
 */
function toSigners(value: Json | undefined): readonly ContractSignerRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isJsonObject).map((entry, index) => ({
    signerId: text(entry, 'signer_id') ?? '',
    fullName: text(entry, 'full_name') ?? '',
    email: text(entry, 'email') ?? '',
    roleLabel: text(entry, 'role_label') ?? 'Client',
    signingOrder: whole(entry, 'signing_order') || index + 1,
    isInternal: entry.is_internal === true,
    status: text(entry, 'status') ?? 'pending',
    invitedAt: text(entry, 'invited_at'),
    viewedAt: text(entry, 'viewed_at'),
    signedAt: text(entry, 'signed_at'),
    signatureType: text(entry, 'signature_type'),
    typedSignature: text(entry, 'typed_signature'),
    declinedAt: text(entry, 'declined_at'),
    declineReason: text(entry, 'decline_reason'),
    hasInvitation: entry.has_invitation === true,
  }));
}

/**
 * Maps the trail of the agreement.
 *
 * @param value The trail as the database returned it.
 * @returns The entries in the order they happened.
 */
function toEvents(value: Json | undefined): readonly ContractEventRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isJsonObject).map((entry) => ({
    occurredAt: text(entry, 'occurred_at') ?? '',
    eventType: text(entry, 'event_type') ?? 'created',
    description: text(entry, 'description') ?? '',
    signerName: text(entry, 'signer_name'),
  }));
}

/**
 * Reads one agreement.
 *
 * @param contractId Agreement being read.
 * @returns The agreement, or null when it is gone or belongs elsewhere.
 */
export async function loadContract(contractId: string): Promise<ContractDetailRecord | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('contract_detail', { p_contract_id: contractId });

  if (error || !isJsonObject(data)) {
    if (error) {
      logger.error('One agreement could not be read', error, { contractId });
    }

    return null;
  }

  return {
    contractId: text(data, 'contract_id') ?? contractId,
    contractNumber: text(data, 'contract_number') ?? '',
    title: text(data, 'title') ?? '',
    status: text(data, 'status') ?? 'draft',
    clientId: text(data, 'client_id'),
    clientName: text(data, 'client_name'),
    bodyHtml: text(data, 'body_html') ?? '',
    contentHash: text(data, 'content_hash'),
    currency: text(data, 'currency'),
    contractValue: text(data, 'contract_value'),
    effectiveDate: text(data, 'effective_date'),
    expiryDate: text(data, 'expiry_date'),
    validUntil: text(data, 'valid_until'),
    signingOrderEnforced: data.signing_order_enforced === true,
    signerCount: whole(data, 'signer_count'),
    signedCount: whole(data, 'signed_count'),
    sentAt: text(data, 'sent_at'),
    firstViewedAt: text(data, 'first_viewed_at'),
    completedAt: text(data, 'completed_at'),
    declinedAt: text(data, 'declined_at'),
    declineReason: text(data, 'decline_reason'),
    voidedAt: text(data, 'voided_at'),
    voidReason: text(data, 'void_reason'),
    sealedAt: text(data, 'sealed_at'),
    sealedSha256: text(data, 'sealed_sha256'),
    notes: text(data, 'notes'),
    signers: toSigners(data.signers),
    events: toEvents(data.events),
  };
}
