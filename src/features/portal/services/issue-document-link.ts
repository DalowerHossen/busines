// src/features/portal/services/issue-document-link.ts
// Creating the signed link a client opens. It is used both when the owner
// copies a link by hand and when a document is emailed, so the rules about
// expiry and email codes are written once.

import 'server-only';

import { randomSecret, sha256Hex } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readBoolean, readNumber } from '@/lib/records';
import type { ServerSupabaseClient } from '@/lib/supabase/server';

const MILLISECONDS_IN_A_DAY = 24 * 60 * 60 * 1000;

export interface IssuedDocumentLink {
  /** Identifier of the stored link. */
  linkId: string;
  /** The token, which exists nowhere else once this call returns. */
  token: string;
  /** Path the client opens. */
  linkPath: string;
  /** When the link stops working. */
  expiresAt: string;
  /** True when the client is asked for an emailed code first. */
  requiresEmailOtp: boolean;
}

export interface IssueDocumentLinkInput {
  companyId: string;
  documentKind: 'invoice' | 'estimate' | 'contract';
  documentId: string;
  recipientEmail: string | null;
  createdBy: string;
}

/**
 * Issues a fresh client link for one document.
 *
 * @param supabase Client acting for the signed in account.
 * @param input Which document is being shared and with whom.
 * @returns The link, including the token the caller must pass on at once.
 */
export async function issueDocumentLink(
  supabase: ServerSupabaseClient,
  input: IssueDocumentLinkInput
): Promise<IssuedDocumentLink> {
  const { data: policy } = await supabase
    .from('tenant_security_policies')
    .select('document_link_ttl_days, require_email_otp_for_links')
    .eq('company_id', input.companyId)
    .maybeSingle();

  const policyRow = asRow(policy) ?? {};
  const ttlDays = readNumber(policyRow, 'document_link_ttl_days') ?? 30;
  const requiresEmailOtp = readBoolean(policyRow, 'require_email_otp_for_links');
  const expiresAt = new Date(Date.now() + ttlDays * MILLISECONDS_IN_A_DAY).toISOString();
  const token = randomSecret(32);

  const { data, error } = await supabase
    .from('document_links')
    .insert({
      company_id: input.companyId,
      document_kind: input.documentKind,
      document_id: input.documentId,
      token_hash: sha256Hex(token),
      short_code: randomSecret(9),
      recipient_email: input.recipientEmail,
      requires_email_otp: requiresEmailOtp,
      expires_at: expiresAt,
      created_by: input.createdBy,
    })
    .select('id')
    .single();

  const row = asRow(data);

  if (error || row === null) {
    logger.error('Could not create a client link', error, {
      companyId: input.companyId,
      documentId: input.documentId,
    });

    throw new AppError('database_failure', 'The link could not be created. Please try again.');
  }

  const linkId = typeof row['id'] === 'string' ? row['id'] : '';

  return {
    linkId,
    token,
    linkPath: `/d/${token}`,
    expiresAt,
    requiresEmailOtp,
  };
}
