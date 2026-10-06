import type { InformationReturnRuleSet } from './types';

export interface TaxComplianceActor {
  readonly userId: string;
  readonly platformRole: 'super_admin' | 'reseller' | null;
}

export interface TaxPolicyVersion {
  readonly policyVersion: string;
  readonly taxYear: number;
  readonly sourceUrls: readonly string[];
  readonly effectiveFrom: string;
  readonly reviewedAt: string | null;
}

export function assertSuperAdmin(actor: TaxComplianceActor): void {
  if (actor.platformRole !== 'super_admin') {
    throw new Error('Only a super admin may change platform tax and compliance settings.');
  }
}

export function assertTaxPolicyVersion(
  actor: TaxComplianceActor,
  rules: InformationReturnRuleSet
): void {
  assertSuperAdmin(actor);
  if (!/^us-\d{4}-[a-z0-9-]+$/.test(rules.policyVersion)) {
    throw new Error('Tax policy version must identify a year and immutable source revision.');
  }
  if (
    rules.sourceUrls.length === 0 ||
    rules.sourceUrls.some((url) => !url.startsWith('https://'))
  ) {
    throw new Error('Tax policy changes require authoritative HTTPS source metadata.');
  }
  if (rules.taxYear < 2026) {
    throw new Error('Tax policy changes must use a supported tax year.');
  }
  if (rules.backupWithholdingRate < 0 || rules.backupWithholdingRate > 100) {
    throw new Error('Backup withholding rate must be between 0 and 100 percent.');
  }
}

export function createImmutableTaxPolicySnapshot(
  actor: TaxComplianceActor,
  rules: InformationReturnRuleSet,
  effectiveFrom: Date
): TaxPolicyVersion {
  assertTaxPolicyVersion(actor, rules);
  return {
    policyVersion: rules.policyVersion,
    taxYear: rules.taxYear,
    sourceUrls: [...rules.sourceUrls],
    effectiveFrom: effectiveFrom.toISOString(),
    reviewedAt: null,
  };
}
