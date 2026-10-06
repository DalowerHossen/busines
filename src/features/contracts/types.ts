// src/features/contracts/types.ts
// The shapes the agreement screens work with: what was agreed, who has to
// sign it, and everything that has happened to it.

export interface ContractSummaryRecord {
  contractId: string;
  contractNumber: string;
  title: string;
  status: string;
  clientId: string | null;
  clientName: string | null;
  currency: string | null;
  contractValue: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  validUntil: string | null;
  signerCount: number;
  signedCount: number;
  sentAt: string | null;
  completedAt: string | null;
  sealedAt: string | null;
  updatedAt: string;
}

export interface ContractSignerRecord {
  signerId: string;
  fullName: string;
  email: string;
  roleLabel: string;
  signingOrder: number;
  isInternal: boolean;
  status: string;
  invitedAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  signatureType: string | null;
  typedSignature: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  hasInvitation: boolean;
}

export interface ContractEventRecord {
  occurredAt: string;
  eventType: string;
  description: string;
  signerName: string | null;
}

export interface ContractDetailRecord {
  contractId: string;
  contractNumber: string;
  title: string;
  status: string;
  clientId: string | null;
  clientName: string | null;
  bodyHtml: string;
  contentHash: string | null;
  currency: string | null;
  contractValue: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  validUntil: string | null;
  signingOrderEnforced: boolean;
  signerCount: number;
  signedCount: number;
  sentAt: string | null;
  firstViewedAt: string | null;
  completedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  sealedAt: string | null;
  sealedSha256: string | null;
  notes: string | null;
  signers: readonly ContractSignerRecord[];
  events: readonly ContractEventRecord[];
}

export interface ContractOverview {
  draftCount: number;
  awaitingCount: number;
  completedCount: number;
  declinedCount: number;
  signedValue: string;
  awaitingValue: string;
  closingSoon: number;
}

export interface ContractWordingChoice {
  templateId: string;
  templateKey: string;
  name: string;
  description: string | null;
  category: string;
  bodyHtml: string;
  isPlatform: boolean;
}

export interface SigningInvitation {
  signerId: string;
  fullName: string;
  email: string;
  roleLabel: string;
  signerStatus: string;
  signedAt: string | null;
  consentText: string | null;
  contractId: string;
  contractNumber: string;
  title: string;
  status: string;
  bodyHtml: string;
  currency: string | null;
  contractValue: string | null;
  effectiveDate: string | null;
  validUntil: string | null;
  companyName: string | null;
  isOpen: boolean;
  waitingForOthers: boolean;
}
