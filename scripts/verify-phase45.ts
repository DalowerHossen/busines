import assert from 'node:assert/strict';
import {
  AboutPageContent,
  AccessibilityPageContent,
  ApiDocsPageContent,
  BlogPageContent,
  ContactPageContent,
  DpaPageContent,
  FaqPageContent,
  GuidesPageContent,
  PrivacyPageContent,
  RefundPageContent,
  SecurityPageContent,
  StatusPageContent,
  TermsPageContent,
} from '@/features/marketing';
import {
  ACCESSIBILITY_PRACTICES,
  API_RESOURCE_PREVIEWS,
  CONTACT_PATHS,
  PUBLIC_BLOG_POSTS,
  PUBLIC_STATUS_SERVICES,
} from '@/features/marketing/public-pages-data';

for (const component of [
  AboutPageContent,
  AccessibilityPageContent,
  ApiDocsPageContent,
  BlogPageContent,
  ContactPageContent,
  DpaPageContent,
  FaqPageContent,
  GuidesPageContent,
  PrivacyPageContent,
  RefundPageContent,
  SecurityPageContent,
  StatusPageContent,
  TermsPageContent,
]) {
  assert.equal(typeof component, 'function');
}
assert.equal(CONTACT_PATHS.length, 3);
assert.equal(PUBLIC_BLOG_POSTS.length, 3);
assert.equal(
  PUBLIC_STATUS_SERVICES.every((service) => service.status === 'Operational'),
  true
);
assert.ok(API_RESOURCE_PREVIEWS.length >= 4);
assert.ok(ACCESSIBILITY_PRACTICES.length >= 4);

process.stdout.write('Phase 45 public pages part 2 smoke test passed.\n');
