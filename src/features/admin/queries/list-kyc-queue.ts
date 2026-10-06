// src/features/admin/queries/list-kyc-queue.ts
// Every identity check waiting on the platform team, newest request first,
// with just enough of each business to make a decision.

import { logger } from '@/lib/logger';
import { asRows, readAmount, readEnum, readNumber, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { DatabaseRow } from '@/types/database';
import { KYC_STATUSES, RISK_LEVELS, type KycStatus, type RiskLevel } from '@/types/enums';
import { LEGAL_ENTITY_TYPES, type LegalEntityType } from '@/features/kyc/types';

export interface KycQueueDocument {
  id: string;
  documentType: string;
  documentSide: string;
  fileName: string;
  byteSize: number;
  documentNumber: string | null;
  expiresOn: string | null;
}

export interface KycQueueItem {
  id: string;
  companyId: string;
  companyName: string;
  status: KycStatus;
  legalEntityType: LegalEntityType;
  legalName: string;
  registrationNumber: string | null;
  taxIdentificationNumber: string | null;
  incorporationCountry: string;
  representativeName: string;
  representativeEmail: string;
  businessDescription: string | null;
  expectedMonthlyVolume: string | null;
  website: string | null;
  riskLevel: RiskLevel;
  submittedAt: string | null;
  documents: readonly KycQueueDocument[];
}

export interface KycQueue {
  /** Checks waiting for a decision. */
  items: readonly KycQueueItem[];
  /** Checks already decided in the last month, for context. */
  recent: readonly KycQueueItem[];
  /** True when the queue could not be read. */
  isDegraded: boolean;
}

const COLUMNS =
  'id, company_id, status, legal_entity_type, legal_name, registration_number, tax_identification_number, incorporation_country, representative_name, representative_email, business_description, expected_monthly_volume, website, risk_level, submitted_at, companies(display_name)';

/**
 * Reads the business name out of the joined row.
 *
 * @param row Row read from public.kyc_verifications.
 * @returns The display name, or a safe stand-in.
 */
function companyNameOf(row: DatabaseRow): string {
  const joined = row['companies'];

  if (joined !== null && typeof joined === 'object' && !Array.isArray(joined)) {
    const name = (joined as Record<string, unknown>)['display_name'];

    if (typeof name === 'string' && name.length > 0) {
      return name;
    }
  }

  return 'Unnamed business';
}

/**
 * Maps one check for the review queue.
 *
 * @param row Row read from public.kyc_verifications.
 * @param documents Papers uploaded against the check.
 * @returns The queue item.
 */
function toItem(row: DatabaseRow, documents: readonly KycQueueDocument[]): KycQueueItem {
  return {
    id: readString(row, 'id') ?? '',
    companyId: readString(row, 'company_id') ?? '',
    companyName: companyNameOf(row),
    status: readEnum(row, 'status', KYC_STATUSES, 'submitted'),
    legalEntityType: readEnum(row, 'legal_entity_type', LEGAL_ENTITY_TYPES, 'company'),
    legalName: readString(row, 'legal_name') ?? '',
    registrationNumber: readString(row, 'registration_number'),
    taxIdentificationNumber: readString(row, 'tax_identification_number'),
    incorporationCountry: readString(row, 'incorporation_country') ?? '',
    representativeName: readString(row, 'representative_name') ?? '',
    representativeEmail: readString(row, 'representative_email') ?? '',
    businessDescription: readString(row, 'business_description'),
    expectedMonthlyVolume:
      row['expected_monthly_volume'] === null ? null : readAmount(row, 'expected_monthly_volume'),
    website: readString(row, 'website'),
    riskLevel: readEnum(row, 'risk_level', RISK_LEVELS, 'low'),
    submittedAt: readString(row, 'submitted_at'),
    documents,
  };
}

/**
 * Maps one uploaded paper for the review queue.
 *
 * @param row Row read from public.kyc_documents.
 * @returns The paper as the queue shows it.
 */
function toDocument(row: DatabaseRow): KycQueueDocument {
  return {
    id: readString(row, 'id') ?? '',
    documentType: readString(row, 'document_type') ?? 'other',
    documentSide: readString(row, 'document_side') ?? 'single',
    fileName: readString(row, 'file_name') ?? '',
    byteSize: readNumber(row, 'byte_size') ?? 0,
    documentNumber: readString(row, 'document_number'),
    expiresOn: readString(row, 'expires_on'),
  };
}

/**
 * Reads the identity checks the platform team has to work through.
 *
 * @returns The waiting checks, the recent decisions and whether the read failed.
 */
export async function loadKycQueue(): Promise<KycQueue> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from('kyc_verifications')
    .select(COLUMNS)
    .in('status', ['submitted', 'under_review'])
    .is('deleted_at', null)
    .order('submitted_at', { ascending: true })
    .limit(50);

  if (error) {
    logger.error('The identity check queue could not be read', error, {});

    return { items: [], recent: [], isDegraded: true };
  }

  const rows = asRows(data);
  const ids = rows.map((row) => readString(row, 'id') ?? '').filter((id) => id.length > 0);

  const documentsByVerification = new Map<string, KycQueueDocument[]>();

  if (ids.length > 0) {
    const { data: documentData } = await supabase
      .from('kyc_documents')
      .select(
        'id, verification_id, document_type, document_side, file_name, byte_size, document_number, expires_on'
      )
      .in('verification_id', ids)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    for (const row of asRows(documentData)) {
      const key = readString(row, 'verification_id') ?? '';
      const bucket = documentsByVerification.get(key) ?? [];

      bucket.push(toDocument(row));
      documentsByVerification.set(key, bucket);
    }
  }

  const { data: recentData } = await supabase
    .from('kyc_verifications')
    .select(COLUMNS)
    .in('status', ['verified', 'rejected'])
    .is('deleted_at', null)
    .order('reviewed_at', { ascending: false })
    .limit(10);

  return {
    items: rows.map((row) =>
      toItem(row, documentsByVerification.get(readString(row, 'id') ?? '') ?? [])
    ),
    recent: asRows(recentData).map((row) => toItem(row, [])),
    isDegraded: false,
  };
}
