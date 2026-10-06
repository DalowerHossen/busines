// src/app/api/kyc/documents/route.ts
// Uploading one identity paper. The file goes straight into private storage
// under a key nobody can guess, and only the reference is kept in the check.

import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';

import { ACCEPTED_DOCUMENT_TYPES, UPLOAD_LIMITS } from '@/config/app';
import { uploadDocumentSchema } from '@/features/kyc/validation/kyc';
import { recordAuditEntry } from '@/lib/audit/record';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { randomSecret } from '@/lib/crypto/hashing';
import { createdResponse, errorResponse, HTTP_STATUS } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { toFieldErrors } from '@/lib/validation/primitives';

export const dynamic = 'force-dynamic';

/** Bucket the identity papers live in. It is private and never served direct. */
const BUCKET = 'kyc-documents';

/**
 * Works out the file extension to store the paper under.
 *
 * @param fileName Name the browser sent.
 * @param mimeType Type the browser reported.
 * @returns An extension without the dot.
 */
function extensionFor(fileName: string, mimeType: string): string {
  const fromName = fileName.includes('.') ? fileName.split('.').pop() : null;

  if (fromName && /^[a-zA-Z0-9]{1,5}$/.test(fromName)) {
    return fromName.toLowerCase();
  }

  return mimeType === 'application/pdf' ? 'pdf' : 'bin';
}

/**
 * Accepts one identity paper.
 *
 * @param request Incoming multipart request.
 * @returns What was stored, or an explanation in the usual shape.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();

  if (!user) {
    return errorResponse(
      'Sign in to upload a document.',
      HTTP_STATUS.unauthorised,
      'unauthenticated'
    );
  }

  if (user.role !== 'owner' && user.role !== 'super_admin') {
    return errorResponse(
      'Only the owner of the business may upload identity papers.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return errorResponse(
      'This account is not attached to a business.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  const limit = await consumeRateLimit({
    kind: 'kyc_upload',
    key: company.id,
    limit: 30,
    windowSeconds: 3600,
  });

  if (!limit.isAllowed) {
    return errorResponse(
      'That is a lot of uploads in one hour. Try again shortly.',
      HTTP_STATUS.tooManyRequests,
      'rate_limited'
    );
  }

  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return errorResponse(
      'Attach the photograph or scan.',
      HTTP_STATUS.unprocessable,
      'validation_failed'
    );
  }

  const parsed = uploadDocumentSchema.safeParse({
    verificationId: form.get('verificationId'),
    documentType: form.get('documentType'),
    documentSide: form.get('documentSide'),
    documentNumber: form.get('documentNumber') ?? undefined,
    issuingCountry: form.get('issuingCountry') ?? undefined,
    expiresOn: form.get('expiresOn') ?? undefined,
  });

  if (!parsed.success) {
    return errorResponse(
      'Check the document details and try again.',
      HTTP_STATUS.unprocessable,
      'validation_failed',
      toFieldErrors(parsed.error)
    );
  }

  if (file.size > UPLOAD_LIMITS.kycDocumentBytes) {
    return errorResponse(
      'That file is larger than 10 MB. Photograph it again at a lower resolution.',
      HTTP_STATUS.unprocessable,
      'validation_failed'
    );
  }

  if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type as (typeof ACCEPTED_DOCUMENT_TYPES)[number])) {
    return errorResponse(
      'Upload a PDF, a PNG or a JPEG.',
      HTTP_STATUS.unprocessable,
      'validation_failed'
    );
  }

  const supabase = createServerSupabaseClient();

  const { data: ownedData } = await supabase
    .from('kyc_verifications')
    .select('id, status')
    .eq('id', parsed.data.verificationId)
    .eq('company_id', company.id)
    .is('deleted_at', null)
    .maybeSingle();

  const owned = asRow(ownedData);

  if (owned === null) {
    return errorResponse('That identity check was not found.', HTTP_STATUS.notFound, 'not_found');
  }

  const status = readString(owned, 'status');

  if (status === 'submitted' || status === 'under_review' || status === 'verified') {
    return errorResponse(
      'This check is with us already, so it cannot be changed.',
      HTTP_STATUS.conflict,
      'conflict'
    );
  }

  const service = getServiceSupabaseClient();
  const extension = extensionFor(file.name, file.type);
  const storageKey = `kyc/${company.id}/${parsed.data.verificationId}/${parsed.data.documentType}-${parsed.data.documentSide}-${randomSecret(8)}.${extension}`;

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(storageKey, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    logger.error('An identity document could not be stored', uploadError, {
      companyId: company.id,
    });

    return errorResponse(
      'The upload did not complete. Please try once more.',
      HTTP_STATUS.badGateway,
      'integration_failure'
    );
  }

  const { data: insertedData, error: insertError } = await service
    .from('kyc_documents')
    .insert({
      verification_id: parsed.data.verificationId,
      company_id: company.id,
      document_type: parsed.data.documentType,
      document_side: parsed.data.documentSide,
      storage_key: storageKey,
      file_name: file.name,
      mime_type: file.type,
      byte_size: file.size,
      document_number: parsed.data.documentNumber,
      issuing_country: parsed.data.issuingCountry ?? null,
      expires_on: parsed.data.expiresOn ?? null,
      created_by: user.id,
    })
    .select('id')
    .maybeSingle();

  if (insertError) {
    await service.storage.from(BUCKET).remove([storageKey]);

    logger.error('An identity document could not be recorded', insertError, {
      companyId: company.id,
    });

    return errorResponse(
      'That side of this document has already been uploaded.',
      HTTP_STATUS.conflict,
      'conflict'
    );
  }

  const inserted = asRow(insertedData);
  const documentId = inserted === null ? '' : (readString(inserted, 'id') ?? '');

  await recordAuditEntry({
    action: 'insert',
    entityType: 'kyc_document',
    entityId: documentId,
    companyId: company.id,
    description: `Identity document uploaded: ${parsed.data.documentType} ${parsed.data.documentSide}.`,
  });

  return createdResponse({ documentId, fileName: file.name });
}
