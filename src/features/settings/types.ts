// src/features/settings/types.ts
// The shapes the settings pages work with: the business identity written onto
// documents, the document defaults, and the rules the team is held to.

export interface CompanyProfileSettings {
  id: string | null;
  legalName: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  supportEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string;
  taxId: string | null;
  vatNumber: string | null;
  registrationNumber: string | null;
  taxRegistrationLabel: string;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankRoutingNumber: string | null;
  bankSwiftCode: string | null;
  bankIban: string | null;
  remitToInstructions: string | null;
  invoicePrefix: string;
  estimatePrefix: string;
  receiptPrefix: string;
  numberPadding: number;
  numberingResetPolicy: 'never' | 'yearly' | 'monthly';
  defaultPaymentTermsDays: number;
  defaultNotes: string | null;
  defaultTerms: string | null;
  defaultFooterText: string | null;
  brandPrimaryColor: string;
  brandAccentColor: string;
  invoiceTemplateKey: 'classic' | 'modern' | 'minimal' | 'compact';
  paperSize: 'a4' | 'letter';
  showPlatformBadge: boolean;
  logoUrl: string | null;
}

export interface SecurityPolicySettings {
  requireTwoFactor: boolean;
  requireTwoFactorForOwner: boolean;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  requireEmailOtpForLinks: boolean;
  documentLinkTtlDays: number;
  requireApprovalForRefunds: boolean;
  staffSingleActionCap: string | null;
  staffDailyCap: string | null;
}

export interface CompanySettings {
  profile: CompanyProfileSettings;
  security: SecurityPolicySettings;
  /** True when the figures could not be read and the defaults are shown. */
  isDegraded: boolean;
}
