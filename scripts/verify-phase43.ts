import assert from 'node:assert/strict';
import { AuthShell } from '@/features/auth';
import { OnboardingWizard, DEFAULT_ONBOARDING_PLANS } from '@/features/onboarding';
import { onboardingSchema } from '@/lib/validators';
import { CompanyProvider, useCompany } from '@/providers';

const parsed = onboardingSchema.safeParse({
  planTierId: 'free',
  companyName: 'Example Company',
  industry: 'service',
  defaultCountry: 'US',
  defaultCurrency: 'USD',
  invoicePrefix: 'INV',
  paymentTermsDays: 30,
  requireEmailOtpForClientLinks: false,
});
assert.equal(parsed.success, true);
assert.equal(
  onboardingSchema.safeParse({
    ...(parsed.success ? parsed.data : {}),
    invoicePrefix: 'invalid prefix',
  }).success,
  false
);
assert.equal(DEFAULT_ONBOARDING_PLANS[0]?.tierId, 'free');
assert.equal(typeof OnboardingWizard, 'function');
assert.equal(typeof AuthShell, 'function');
assert.equal(typeof CompanyProvider, 'function');
assert.equal(typeof useCompany, 'function');

process.stdout.write('Phase 43 onboarding and company-provider smoke test passed.\n');
