// src/lib/pdf/hash-store.ts
// Trusted server repository for the exact rendered hash fields added in the
// invoice/estimate schema. The company filter is repeated even for a
// service-role client so an incorrect caller cannot update another tenant.
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { PdfRenderError } from './errors';

export type PdfHashDocumentType = 'invoice' | 'estimate';

export interface PdfHashRecordInput {
  readonly companyId: string;
  readonly documentId: string;
  readonly documentType: PdfHashDocumentType;
  readonly sha256: string;
  readonly computedAt?: string;
}

export interface PdfHashStore {
  record(input: PdfHashRecordInput): Promise<void>;
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function validateHashInput(input: PdfHashRecordInput): void {
  if (
    !input.companyId ||
    !input.documentId ||
    !SHA256_PATTERN.test(input.sha256) ||
    (input.computedAt !== undefined && Number.isNaN(Date.parse(input.computedAt)))
  ) {
    throw new PdfRenderError('invalid_document');
  }
}

export function createSupabasePdfHashStore(client: SupabaseClient): PdfHashStore {
  return {
    async record(input) {
      validateHashInput(input);
      const table = input.documentType === 'invoice' ? 'invoices' : 'estimates';
      const { data, error } = await client
        .from(table)
        .update({
          rendered_pdf_hash: input.sha256,
          rendered_pdf_hash_computed_at: input.computedAt ?? new Date().toISOString(),
        })
        .eq('id', input.documentId)
        .eq('company_id', input.companyId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle<{ id: string }>();

      if (error || !data?.id) throw new PdfRenderError('render_failed');
    },
  };
}
