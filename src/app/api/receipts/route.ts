// src/app/api/receipts/route.ts
// Taking in a photograph of a receipt. The picture goes into private storage,
// the business only ever sees the reference, and the same picture uploaded
// twice is recognised rather than counted twice.

import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';

import { UPLOAD_LIMITS } from '@/config/app';
import { uploadReceiptSchema } from '@/features/receipts/validation/receipts';
import { recordAuditEntry } from '@/lib/audit/record';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { randomSecret, sha256OfBuffer } from '@/lib/crypto/hashing';
import { createdResponse, errorResponse, HTTP_STATUS } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { RECEIPT_BUCKET } from '@/lib/ocr/read-receipts';
import { can } from '@/lib/auth/permissions';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { toFieldErrors } from '@/lib/validation/primitives';

export const dynamic = 'force-dynamic';

/** The picture formats a reader can make sense of. */
const ACCEPTED_RECEIPT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const;

/**
 * Works out the extension to store the picture under.
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

  return mimeType === 'application/pdf' ? 'pdf' : 'jpg';
}

/**
 * Accepts one photographed receipt.
 *
 * @param request Incoming multipart request.
 * @returns The scan that was created, or an explanation in the usual shape.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();

  if (!user) {
    return errorResponse('Sign in to send a receipt.', HTTP_STATUS.unauthorised, 'unauthenticated');
  }

  if (!can(user, 'expenses', 'create')) {
    return errorResponse(
      'You do not have permission to add expenses.',
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

  if (company.isReadOnly) {
    return errorResponse(
      'This business is read only at the moment.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  const limit = await consumeRateLimit({
    kind: 'receipt_upload',
    key: company.id,
    limit: 120,
    windowSeconds: 3600,
  });

  if (!limit.isAllowed) {
    return errorResponse(
      'That is a lot of receipts in one hour. Try again shortly.',
      HTTP_STATUS.tooManyRequests,
      'rate_limited'
    );
  }

  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return errorResponse(
      'Attach the photograph of the receipt.',
      HTTP_STATUS.unprocessable,
      'validation_failed'
    );
  }

  const parsed = uploadReceiptSchema.safeParse({ source: form.get('source') ?? 'upload' });

  if (!parsed.success) {
    return errorResponse(
      'Check where this receipt came from and try again.',
      HTTP_STATUS.unprocessable,
      'validation_failed',
      toFieldErrors(parsed.error)
    );
  }

  if (file.size > UPLOAD_LIMITS.receiptBytes) {
    return errorResponse(
      'That file is larger than 10 MB. Photograph it again at a lower resolution.',
      HTTP_STATUS.unprocessable,
      'validation_failed'
    );
  }

  if (!ACCEPTED_RECEIPT_TYPES.includes(file.type as (typeof ACCEPTED_RECEIPT_TYPES)[number])) {
    return errorResponse(
      'Send a photograph as JPEG, PNG, WebP or HEIC, or send a PDF.',
      HTTP_STATUS.unprocessable,
      'validation_failed'
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentHash = sha256OfBuffer(bytes);
  const service = getServiceSupabaseClient();
  const storageKey = `receipts/${company.id}/${contentHash.slice(0, 8)}-${randomSecret(8)}.${extensionFor(file.name, file.type)}`;

  const { error: uploadError } = await service.storage
    .from(RECEIPT_BUCKET)
    .upload(storageKey, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    logger.error('A receipt could not be stored', uploadError, { companyId: company.id });

    return errorResponse(
      'The upload did not complete. Please try once more.',
      HTTP_STATUS.badGateway,
      'integration_failure'
    );
  }

  const { data, error } = await service.rpc('submit_receipt_scan', {
    p_company_id: company.id,
    p_storage_key: storageKey,
    p_file_name: file.name,
    p_content_type: file.type,
    p_byte_size: file.size,
    p_content_hash: contentHash,
    p_source: parsed.data.source,
  });

  if (error || typeof data !== 'string') {
    await service.storage.from(RECEIPT_BUCKET).remove([storageKey]);

    logger.error('A receipt could not be recorded', error, { companyId: company.id });

    return errorResponse(
      'That receipt could not be taken in. Please try once more.',
      HTTP_STATUS.badGateway,
      'database_failure'
    );
  }

  await recordAuditEntry({
    action: 'insert',
    entityType: 'receipt_scan',
    entityId: data,
    companyId: company.id,
    description: 'Sent a receipt to be read',
    metadata: { source: parsed.data.source },
  });

  return createdResponse({ scanId: data });
}
