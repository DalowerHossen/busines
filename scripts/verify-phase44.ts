import assert from 'node:assert/strict';
import {
  FaqPageContent,
  FeaturesPageContent,
  HomePageContent,
  MerchantOnboardingPageContent,
  PricingPageContent,
  PublicSiteFrame,
  TestimonialsPageContent,
} from '@/features/marketing';
import {
  FAQ_ITEMS,
  MARKETING_FEATURES,
  MERCHANT_STEPS,
  PLAN_PREVIEWS,
} from '@/features/marketing/marketing-data';

for (const component of [
  FaqPageContent,
  FeaturesPageContent,
  HomePageContent,
  MerchantOnboardingPageContent,
  PricingPageContent,
  PublicSiteFrame,
  TestimonialsPageContent,
]) {
  assert.equal(typeof component, 'function');
}
assert.ok(MARKETING_FEATURES.length >= 6);
assert.equal(FAQ_ITEMS.length, 6);
assert.equal(MERCHANT_STEPS.length, 4);
assert.equal(PLAN_PREVIEWS[0]?.name, 'Free');

process.stdout.write('Phase 44 public marketing pages smoke test passed.\n');
