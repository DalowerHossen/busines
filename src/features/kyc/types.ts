// src/features/kyc/types.ts
// The shapes the identity check works with: what a business told us about
// itself, and the papers it uploaded to prove it.

import type { KycStatus, RiskLevel } from '@/types/enums';

/** The kinds of paper the platform accepts. */
export const KYC_DOCUMENT_TYPES = [
  'national_id',
  'passport',
  'driving_licence',
  'business_registration',
  'tax_certificate',
  'bank_statement',
  'utility_bill',
  'board_resolution',
  'other',
] as const;

export type KycDocumentType = (typeof KYC_DOCUMENT_TYPES)[number];

export const KYC_DOCUMENT_SIDES = ['front', 'back', 'single'] as const;

export type KycDocumentSide = (typeof KYC_DOCUMENT_SIDES)[number];

export const LEGAL_ENTITY_TYPES = ['sole_trader', 'partnership', 'company', 'non_profit'] as const;

export type LegalEntityType = (typeof LEGAL_ENTITY_TYPES)[number];

export interface KycDocument {
  id: string;
  documentType: KycDocumentType;
  documentSide: KycDocumentSide;
  fileName: string;
  byteSize: number;
  documentNumber: string | null;
  issuingCountry: string | null;
  expiresOn: string | null;
  isAccepted: boolean | null;
  reviewNote: string | null;
  uploadedAt: string;
}

export interface KycVerification {
  id: string;
  companyId: string;
  status: KycStatus;
  legalEntityType: LegalEntityType;
  legalName: string;
  registrationNumber: string | null;
  taxIdentificationNumber: string | null;
  incorporationCountry: string;
  incorporationDate: string | null;
  representativeName: string;
  representativeRole: string | null;
  representativeEmail: string;
  representativePhone: string | null;
  representativeDateOfBirth: string | null;
  registeredAddressLine1: string | null;
  registeredAddressLine2: string | null;
  registeredCity: string | null;
  registeredRegion: string | null;
  registeredPostalCode: string | null;
  registeredCountry: string;
  businessDescription: string | null;
  expectedMonthlyVolume: string | null;
  website: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  rejectionReason: string | null;
  expiresOn: string | null;
  riskLevel: RiskLevel;
  documents: readonly KycDocument[];
}

export interface VerificationOverview {
  verification: KycVerification | null;
  /** True when the check could not be read. */
  isDegraded: boolean;
}
