// src/features/kyc/queries/get-verification.ts
// Reading the identity check of one business, with the papers already
// uploaded against it.

import type { KycDocument, KycVerification, VerificationOverview } from '@/features/kyc/types';
import { KYC_DOCUMENT_SIDES, KYC_DOCUMENT_TYPES, LEGAL_ENTITY_TYPES } from '@/features/kyc/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readEnum, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import { KYC_STATUSES, RISK_LEVELS } from '@/types/enums';

const VERIFICATION_COLUMNS =
  'id, company_id, status, legal_entity_type, legal_name, registration_number, tax_identification_number, incorporation_country, incorporation_date, representative_name, representative_role, representative_email, representative_phone, representative_date_of_birth, registered_address_line1, registered_address_line2, registered_city, registered_region, registered_postal_code, registered_country, business_description, expected_monthly_volume, website, submitted_at, reviewed_at, review_note, rejection_reason, expires_on, risk_level';

/**
 * Maps one uploaded paper.
 *
 * @param row Row read from public.kyc_documents.
 * @returns The document the page renders.
 */
function toDocument(row: DatabaseRow): KycDocument {
  return {
    id: readString(row, 'id') ?? '',
    documentType: readEnum(row, 'document_type', KYC_DOCUMENT_TYPES, 'other'),
    documentSide: readEnum(row, 'document_side', KYC_DOCUMENT_SIDES, 'single'),
    fileName: readString(row, 'file_name') ?? '',
    byteSize: readNumber(row, 'byte_size') ?? 0,
    documentNumber: readString(row, 'document_number'),
    issuingCountry: readString(row, 'issuing_country'),
    expiresOn: readString(row, 'expires_on'),
    isAccepted: row['is_accepted'] === null ? null : row['is_accepted'] === true,
    reviewNote: readString(row, 'review_note'),
    uploadedAt: readString(row, 'created_at') ?? '',
  };
}

/**
 * Maps the check itself.
 *
 * @param row Row read from public.kyc_verifications.
 * @param documents Papers uploaded against it.
 * @returns The check the page renders.
 */
function toVerification(row: DatabaseRow, documents: readonly KycDocument[]): KycVerification {
  return {
    id: readString(row, 'id') ?? '',
    companyId: readString(row, 'company_id') ?? '',
    status: readEnum(row, 'status', KYC_STATUSES, 'in_progress'),
    legalEntityType: readEnum(row, 'legal_entity_type', LEGAL_ENTITY_TYPES, 'company'),
    legalName: readString(row, 'legal_name') ?? '',
    registrationNumber: readString(row, 'registration_number'),
    taxIdentificationNumber: readString(row, 'tax_identification_number'),
    incorporationCountry: readString(row, 'incorporation_country') ?? 'US',
    incorporationDate: readString(row, 'incorporation_date'),
    representativeName: readString(row, 'representative_name') ?? '',
    representativeRole: readString(row, 'representative_role'),
    representativeEmail: readString(row, 'representative_email') ?? '',
    representativePhone: readString(row, 'representative_phone'),
    representativeDateOfBirth: readString(row, 'representative_date_of_birth'),
    registeredAddressLine1: readString(row, 'registered_address_line1'),
    registeredAddressLine2: readString(row, 'registered_address_line2'),
    registeredCity: readString(row, 'registered_city'),
    registeredRegion: readString(row, 'registered_region'),
    registeredPostalCode: readString(row, 'registered_postal_code'),
    registeredCountry: readString(row, 'registered_country') ?? 'US',
    businessDescription: readString(row, 'business_description'),
    expectedMonthlyVolume:
      row['expected_monthly_volume'] === null ? null : readAmount(row, 'expected_monthly_volume'),
    website: readString(row, 'website'),
    submittedAt: readString(row, 'submitted_at'),
    reviewedAt: readString(row, 'reviewed_at'),
    reviewNote: readString(row, 'review_note'),
    rejectionReason: readString(row, 'rejection_reason'),
    expiresOn: readString(row, 'expires_on'),
    riskLevel: readEnum(row, 'risk_level', RISK_LEVELS, 'low'),
    documents,
  };
}

/**
 * Reads the identity check of one business.
 *
 * @param companyId Business whose check is read.
 * @returns The check and its papers, when there is one.
 */
export async function loadVerification(companyId: string): Promise<VerificationOverview> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('kyc_verifications')
    .select(VERIFICATION_COLUMNS)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = asRow(data);

  if (error) {
    logger.error('The identity check could not be read', error, { companyId });

    return { verification: null, isDegraded: true };
  }

  if (row === null) {
    return { verification: null, isDegraded: false };
  }

  const { data: documentData } = await supabase
    .from('kyc_documents')
    .select(
      'id, document_type, document_side, file_name, byte_size, document_number, issuing_country, expires_on, is_accepted, review_note, created_at'
    )
    .eq('verification_id', readString(row, 'id') ?? '')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  return {
    verification: toVerification(row, asRows(documentData).map(toDocument)),
    isDegraded: false,
  };
}
