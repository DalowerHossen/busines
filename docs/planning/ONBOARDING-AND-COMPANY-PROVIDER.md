# Onboarding and CompanyProvider

Phase 43 adds the initial company setup flow and the client context boundary.

## Onboarding wizard

`src/features/onboarding/OnboardingWizard` is a three-step, keyboard-friendly flow:

1. Plan selection, with Free selected by default and editable plan options.
2. Company identity and initial industry/country/currency defaults.
3. Invoice prefix, payment terms, and the optional client-link email OTP setting.

Every step is validated with the shared Zod boundary before advancing. The final payload is validated again before the typed `OnboardingAction` callback receives it. No prices or plan limits are hard-coded into the wizard; plan options are metadata and live plan values remain server/database configuration.

## CompanyProvider

`src/providers/company-provider.tsx` exposes `useCompany()` with the server-provided allowed company list, active company, active ID, readiness state, and tenant-safe selection callback. `AppProviders` now wraps its children with `CompanyProvider` and passes its initial company snapshot. The Zustand store still only improves rendering; it cannot authorize a company switch. Server actions, route handlers, session membership, and Supabase RLS must re-check tenant access before reading or writing data.

The context intentionally exposes the selected company object so later invoice/profile screens can freeze server-derived company snapshots at document creation. It does not mutate historical invoices when branding or company defaults change.

Run `npm run verify:phase43` for coverage of the Free default, onboarding schema boundaries, wizard export, and provider contract.
