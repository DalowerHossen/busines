import { invalidMorRequest } from './errors';
import { calculatePlatformFee, resolveFeeRule } from './fees';
import type { CardFeeTier, FeeCalculation, FeeRule } from './types';

export type ProviderCardLevel = 'standard' | 'premium' | 'corporate' | 'unknown';

export interface TrustedCardMetadata {
  readonly issuingCountryCode: string | null;
  readonly cardLevel: ProviderCardLevel;
  readonly isCorporate: boolean;
}

export interface AutomaticCardFeeCalculation extends FeeCalculation {
  readonly cardFeeTier: CardFeeTier;
  readonly cardClassificationSource: 'trusted_gateway_metadata';
}

export function classifyCardFeeTier(metadata: TrustedCardMetadata): CardFeeTier {
  if (metadata.issuingCountryCode !== null && !/^[A-Z]{2}$/u.test(metadata.issuingCountryCode)) {
    throw invalidMorRequest();
  }
  if (
    metadata.issuingCountryCode === 'US' &&
    metadata.cardLevel === 'standard' &&
    !metadata.isCorporate
  ) {
    return 'domestic_us_standard';
  }
  return 'premium_international_corporate';
}

export function calculateAutomaticCardFee(input: {
  readonly paymentAmount: string;
  readonly currencyCode: string;
  readonly companyId: string;
  readonly companyRules: readonly FeeRule[];
  readonly platformRules: readonly FeeRule[];
  readonly at: string;
  readonly cardMetadata: TrustedCardMetadata;
}): AutomaticCardFeeCalculation {
  const cardFeeTier = classifyCardFeeTier(input.cardMetadata);
  const rule = resolveFeeRule({
    companyRules: input.companyRules,
    platformRules: input.platformRules,
    companyId: input.companyId,
    at: input.at,
    feeTier: cardFeeTier,
  });
  const calculation = calculatePlatformFee({
    paymentAmount: input.paymentAmount,
    currencyCode: input.currencyCode,
    rule,
    cardFeeTier,
  });
  return {
    ...calculation,
    cardFeeTier,
    cardClassificationSource: 'trusted_gateway_metadata',
  };
}
