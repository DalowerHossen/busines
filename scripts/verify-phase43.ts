import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
assert.equal(
  existsSync(resolve(process.cwd(), 'src/components/onboarding/setup-checklist.tsx')),
  true
);
assert.match(
  readFileSync(resolve(process.cwd(), 'src/app/(app)/dashboard/setup/page.tsx'), 'utf8'),
  /loadOnboardingState/u
);
assert.equal(typeof CompanyProvider, 'function');
assert.equal(typeof useCompany, 'function');

process.stdout.write('Phase 43 onboarding and company-provider smoke test passed.\n');
