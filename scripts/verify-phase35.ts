import assert from 'node:assert/strict';
import { useAppStore, usePlatformStore, useThemeStore } from '@/stores';
import { calculateAutomaticCardFee, classifyCardFeeTier } from '@/lib/mor/card-fees';
import type { FeeRule } from '@/lib/mor/types';

useAppStore.getState().setSidebarOpen(false);
assert.equal(useAppStore.getState().isSidebarOpen, false);
useAppStore.getState().setSidebarOpen(true);
useThemeStore.getState().setTheme('dark');
assert.equal(useThemeStore.getState().theme, 'dark');
useThemeStore.getState().setTheme('system');
usePlatformStore.getState().setMaintenance({ enabled: true, message: 'Maintenance', endsAt: null });
assert.equal(usePlatformStore.getState().maintenance.enabled, true);
usePlatformStore.getState().setMaintenance({ enabled: false, message: null, endsAt: null });

const baseInput = {
  paymentAmount: '100.00',
  currencyCode: 'USD',
  companyId: 'company-1',
  companyRules: [],
  platformRules: [],
  at: '2026-10-06T00:00:00Z',
};

assert.equal(
  classifyCardFeeTier({ issuingCountryCode: 'US', cardLevel: 'standard', isCorporate: false }),
  'domestic_us_standard'
);
assert.equal(
  classifyCardFeeTier({ issuingCountryCode: 'GB', cardLevel: 'standard', isCorporate: false }),
  'premium_international_corporate'
);
assert.equal(
  classifyCardFeeTier({ issuingCountryCode: 'US', cardLevel: 'corporate', isCorporate: true }),
  'premium_international_corporate'
);
const domestic = calculateAutomaticCardFee({
  ...baseInput,
  cardMetadata: { issuingCountryCode: 'US', cardLevel: 'standard', isCorporate: false },
});
assert.equal(domestic.cardFeeTier, 'domestic_us_standard');
assert.equal(domestic.percentageRate, '2.7000');
assert.equal(domestic.chargedFeeAmount, '2.9500');
const international = calculateAutomaticCardFee({
  ...baseInput,
  cardMetadata: { issuingCountryCode: 'CA', cardLevel: 'standard', isCorporate: false },
});
assert.equal(international.cardFeeTier, 'premium_international_corporate');
assert.equal(international.percentageRate, '3.7000');
assert.equal(international.chargedFeeAmount, '3.9500');

const premiumOverride: FeeRule = {
  id: 'admin-premium-1',
  companyId: null,
  ruleName: 'Admin premium override',
  cardFeeTier: 'premium_international_corporate',
  percentageRate: '4.1',
  minimumFeeAmount: '0',
  fixedFeeAmount: '0.25',
  currencyCode: 'USD',
  holdPeriodDays: 7,
  payoutSlaHours: 24,
  minimumPayoutAmount: '0',
  isActive: true,
  effectiveFrom: '2026-10-01T00:00:00Z',
  effectiveUntil: null,
};
const changedInternational = calculateAutomaticCardFee({
  ...baseInput,
  platformRules: [premiumOverride],
  cardMetadata: { issuingCountryCode: 'CA', cardLevel: 'standard', isCorporate: false },
});
assert.equal(changedInternational.percentageRate, '4.1000');
assert.equal(changedInternational.chargedFeeAmount, '4.3500');

process.stdout.write('Automatic card-tier fee smoke test passed.\n');
