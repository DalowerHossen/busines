export interface SalesTaxJurisdictionRule {
  readonly jurisdictionCode: string;
  readonly jurisdictionName: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly collectionRequired: boolean;
  readonly marketplaceFacilitatorCollectionRequired: boolean;
  readonly economicNexusAmount: number | null;
  readonly economicNexusTransactions: number | null;
  readonly taxRate: number;
  readonly remittanceRequired: boolean;
  readonly sellerReportingRequired: boolean;
  readonly customerNoticeRequired: boolean;
  readonly filingDueRule: string | null;
  readonly sourceUrl: string;
  readonly sourceVersion: string;
}

export interface SalesTaxActivity {
  readonly grossSalesAmount: number;
  readonly transactionCount: number;
  readonly taxAlreadyCollectedByFacilitator: boolean;
}

export interface SalesTaxDecision {
  readonly jurisdictionCode: string;
  readonly shouldCollect: boolean;
  readonly reason:
    | 'disabled_by_rule'
    | 'below_configured_nexus'
    | 'marketplace_facilitator_collection'
    | 'nexus_reached';
  readonly rate: number;
  readonly sourceUrl: string;
  readonly sourceVersion: string;
}

export interface TaxableSale {
  readonly grossAmount: number;
  readonly exemptAmount: number;
  readonly taxableAmount: number;
}

export interface SalesTaxRemittanceSummary {
  readonly jurisdictionCode: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly grossSalesAmount: number;
  readonly taxableSalesAmount: number;
  readonly exemptSalesAmount: number;
  readonly taxCollectedAmount: number;
  readonly remittanceRequired: boolean;
  readonly sellerReportingRequired: boolean;
  readonly customerNoticeRequired: boolean;
  readonly filingDueRule: string | null;
  readonly sourceUrl: string;
  readonly sourceVersion: string;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function hasReachedNexus(activity: SalesTaxActivity, rule: SalesTaxJurisdictionRule): boolean {
  const amountReached =
    rule.economicNexusAmount !== null && activity.grossSalesAmount >= rule.economicNexusAmount;
  const transactionReached =
    rule.economicNexusTransactions !== null &&
    activity.transactionCount >= rule.economicNexusTransactions;
  return amountReached || transactionReached;
}

export function decideSalesTaxCollection(
  activity: SalesTaxActivity,
  rule: SalesTaxJurisdictionRule
): SalesTaxDecision {
  if (!rule.collectionRequired) {
    return {
      jurisdictionCode: rule.jurisdictionCode,
      shouldCollect: false,
      reason: 'disabled_by_rule',
      rate: rule.taxRate,
      sourceUrl: rule.sourceUrl,
      sourceVersion: rule.sourceVersion,
    };
  }

  if (rule.marketplaceFacilitatorCollectionRequired && activity.taxAlreadyCollectedByFacilitator) {
    return {
      jurisdictionCode: rule.jurisdictionCode,
      shouldCollect: false,
      reason: 'marketplace_facilitator_collection',
      rate: rule.taxRate,
      sourceUrl: rule.sourceUrl,
      sourceVersion: rule.sourceVersion,
    };
  }

  if (!hasReachedNexus(activity, rule)) {
    return {
      jurisdictionCode: rule.jurisdictionCode,
      shouldCollect: false,
      reason: 'below_configured_nexus',
      rate: rule.taxRate,
      sourceUrl: rule.sourceUrl,
      sourceVersion: rule.sourceVersion,
    };
  }

  return {
    jurisdictionCode: rule.jurisdictionCode,
    shouldCollect: true,
    reason: 'nexus_reached',
    rate: rule.taxRate,
    sourceUrl: rule.sourceUrl,
    sourceVersion: rule.sourceVersion,
  };
}

export function calculateTaxableSale(grossAmount: number, exemptAmount: number): TaxableSale {
  if (grossAmount < 0 || exemptAmount < 0 || exemptAmount > grossAmount) {
    throw new Error(
      'Sales tax amounts must be non-negative and exemption cannot exceed gross sales.'
    );
  }

  return {
    grossAmount: roundCurrency(grossAmount),
    exemptAmount: roundCurrency(exemptAmount),
    taxableAmount: roundCurrency(grossAmount - exemptAmount),
  };
}

export function calculateSalesTax(taxableAmount: number, decision: SalesTaxDecision): number {
  if (taxableAmount < 0 || decision.rate < 0 || decision.rate > 100) {
    throw new Error('Taxable amount and configured tax rate must be valid non-negative values.');
  }
  return decision.shouldCollect ? roundCurrency(taxableAmount * (decision.rate / 100)) : 0;
}

export function summarizeSalesTaxRemittance(input: {
  readonly jurisdictionCode: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly rule: SalesTaxJurisdictionRule;
  readonly sales: readonly TaxableSale[];
  readonly collectedAmounts: readonly number[];
}): SalesTaxRemittanceSummary {
  const grossSalesAmount = roundCurrency(
    input.sales.reduce((sum, sale) => sum + sale.grossAmount, 0)
  );
  const taxableSalesAmount = roundCurrency(
    input.sales.reduce((sum, sale) => sum + sale.taxableAmount, 0)
  );
  const exemptSalesAmount = roundCurrency(
    input.sales.reduce((sum, sale) => sum + sale.exemptAmount, 0)
  );
  const taxCollectedAmount = roundCurrency(
    input.collectedAmounts.reduce((sum, amount) => sum + amount, 0)
  );

  return {
    jurisdictionCode: input.jurisdictionCode,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    grossSalesAmount,
    taxableSalesAmount,
    exemptSalesAmount,
    taxCollectedAmount,
    remittanceRequired: input.rule.remittanceRequired,
    sellerReportingRequired: input.rule.sellerReportingRequired,
    customerNoticeRequired: input.rule.customerNoticeRequired,
    filingDueRule: input.rule.filingDueRule,
    sourceUrl: input.rule.sourceUrl,
    sourceVersion: input.rule.sourceVersion,
  };
}
