// Tax-domain contracts are intentionally independent from Supabase rows. They
// accept only already-authorized, server-side data; raw TIN values are never
// represented in these reporting inputs.

export type UsInformationReturnForm = '1099-K' | '1099-NEC' | '1099-MISC';
export type TaxIdentityDocumentType = 'W-9' | 'W-8BEN' | 'W-8BEN-E' | 'W-8ECI' | 'W-8IMY';
export type TaxPersonType = 'us_person' | 'foreign_individual' | 'foreign_entity';
export type TaxPaymentChannel = 'payment_card' | 'third_party_network' | 'other';
export type TaxIncomeCategory =
  | 'goods'
  | 'services'
  | 'rent'
  | 'royalties'
  | 'medical_healthcare'
  | 'attorney'
  | 'prizes_awards'
  | 'other';

export interface TaxAddress {
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly stateOrProvince: string;
  readonly postalCode: string;
  readonly countryCode: string;
}

export interface TaxIdentityProfile {
  readonly payeeId: string;
  readonly legalName: string;
  readonly address: TaxAddress;
  readonly personType: TaxPersonType;
  readonly documentType: TaxIdentityDocumentType;
  readonly tinLastFour: string | null;
  readonly hasEncryptedTin: boolean;
  readonly signedAt: string | null;
  readonly validFrom: string | null;
  readonly validUntil: string | null;
  readonly status: 'submitted' | 'verified' | 'rejected' | 'expired' | 'not_started';
  readonly backupWithholdingRequired: boolean;
  readonly backupWithholdingRate: number;
  readonly entityClassification?: string;
}

export interface TaxPaymentRecord {
  readonly sourceType: 'payment' | 'payout';
  readonly sourceId: string;
  readonly payeeId: string;
  readonly paidAt: string;
  readonly amount: number;
  readonly refundAmount?: number;
  readonly channel: TaxPaymentChannel;
  readonly incomeCategory: TaxIncomeCategory;
  readonly isPaymentCardTransaction?: boolean;
  readonly transactionCount?: number;
  readonly currencyCode: string;
  readonly federalWithholdingAmount?: number;
}

export interface InformationReturnRuleSet {
  readonly taxYear: number;
  readonly policyVersion: string;
  readonly tpsoGrossThreshold: number;
  readonly tpsoTransactionThreshold: number;
  readonly nonEmployeeCompensationThreshold: number;
  readonly miscThresholds: Readonly<Partial<Record<TaxIncomeCategory, number>>>;
  readonly necExemptEntityClassifications: readonly string[];
  readonly miscExemptEntityClassifications: Readonly<
    Partial<Record<TaxIncomeCategory, readonly string[]>>
  >;
  readonly backupWithholdingRate: number;
  readonly filingDeadlines: Readonly<Record<string, string>>;
  readonly sourceUrls: readonly string[];
  readonly irsElectronicFilingSystem: 'IRIS' | 'UNSPECIFIED';
  readonly irsElectronicFilingConfigured: boolean;
}

export interface TaxValidationIssue {
  readonly code:
    | 'missing_tax_identity'
    | 'invalid_tax_identity'
    | 'expired_tax_identity'
    | 'missing_tin'
    | 'missing_filer_configuration'
    | 'unsupported_currency'
    | 'negative_reportable_amount'
    | 'missing_address'
    | 'withholding_mismatch';
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly payeeId?: string;
  readonly formType?: UsInformationReturnForm;
}

export interface InformationReturnRow {
  readonly formType: UsInformationReturnForm;
  readonly payeeId: string;
  readonly recipientName: string;
  readonly recipientAddress: TaxAddress;
  readonly recipientTinLastFour: string | null;
  readonly accountReference: string;
  readonly grossAmount: number;
  readonly transactionCount: number;
  readonly federalWithholdingAmount: number;
  readonly boxes: Readonly<Record<string, string | number>>;
  readonly issues: readonly TaxValidationIssue[];
}

export interface TaxDocumentPackage {
  readonly taxYear: number;
  readonly policyVersion: string;
  readonly status: 'ready' | 'blocked';
  readonly generatedAt: string;
  readonly rows: readonly InformationReturnRow[];
  readonly issues: readonly TaxValidationIssue[];
  readonly csv: string;
  readonly reviewReportHtml: string;
  readonly manifest: Readonly<{
    artifactType: 'us-information-return-review-package';
    filingStatus: 'not_filed';
    filingSystem: 'IRIS' | 'UNSPECIFIED';
    filingConfigurationPresent: boolean;
    sourceUrls: readonly string[];
    rowCount: number;
    contentSha256: string;
  }>;
}

export interface FilerConfiguration {
  readonly legalName: string;
  readonly address: TaxAddress;
  readonly tinLastFour: string | null;
  readonly hasEncryptedEin: boolean;
  readonly hasEncryptedIrsTcc: boolean;
}
