import { createHash } from 'node:crypto';
import { invalidMorRequest, invalidMorState } from './errors';
import type { KycDocumentInput, KycReviewDecision, KycReviewInput, KycStatus } from './types';

const REQUIRED_KYC_DOCUMENTS = ['id_front', 'id_back', 'business_registration'] as const;
const ALLOWED_KYC_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_KYC_DOCUMENT_BYTES = 5_242_880;

export function validateKycDocument(input: KycDocumentInput): KycDocumentInput {
  if (
    !input.providerFileId.trim() ||
    !input.originalFileName.trim() ||
    !ALLOWED_KYC_MIME_TYPES.has(input.mimeType) ||
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes > MAX_KYC_DOCUMENT_BYTES
  ) {
    throw invalidMorRequest();
  }
  if (input.contentSha256 !== undefined && !/^[a-f0-9]{64}$/iu.test(input.contentSha256)) {
    throw invalidMorRequest();
  }
  return {
    ...input,
    providerFileId: input.providerFileId.trim(),
    originalFileName: input.originalFileName.trim(),
  };
}

export function validateKycReview(input: KycReviewInput): KycReviewDecision {
  if (
    !input.companyId.trim() ||
    !input.submissionId.trim() ||
    !input.reviewerUserId.trim() ||
    !input.reviewedAt.trim() ||
    (input.currentStatus !== 'pending_review' && input.currentStatus !== 'rejected')
  ) {
    throw invalidMorState();
  }
  const documents = new Map(
    input.documents.map((document) => [document.documentType, document.status])
  );
  if (input.decision === 'approve') {
    const hasAllAccepted = REQUIRED_KYC_DOCUMENTS.every(
      (documentType) => documents.get(documentType) === 'accepted'
    );
    if (!hasAllAccepted) throw invalidMorState();
    return {
      submissionId: input.submissionId,
      status: 'approved',
      reviewedByUserId: input.reviewerUserId,
      reviewedAt: input.reviewedAt,
      rejectionReason: null,
      reviewerNotes: input.reviewerNotes ?? null,
    };
  }
  if (!input.rejectionReason?.trim()) throw invalidMorRequest();
  return {
    submissionId: input.submissionId,
    status: 'rejected',
    reviewedByUserId: input.reviewerUserId,
    reviewedAt: input.reviewedAt,
    rejectionReason: input.rejectionReason.trim(),
    reviewerNotes: input.reviewerNotes ?? null,
  };
}

export function isKycApproved(status: KycStatus): boolean {
  return status === 'approved';
}

export function kycSubmissionHash(input: {
  readonly companyId: string;
  readonly submissionId: string;
  readonly documentHashes: readonly string[];
  readonly submittedAt: string;
}): string {
  if (!input.companyId || !input.submissionId || !input.submittedAt) throw invalidMorRequest();
  const canonical = JSON.stringify({
    companyId: input.companyId,
    submissionId: input.submissionId,
    documentHashes: [...input.documentHashes].sort(),
    submittedAt: input.submittedAt,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export { REQUIRED_KYC_DOCUMENTS, MAX_KYC_DOCUMENT_BYTES };
