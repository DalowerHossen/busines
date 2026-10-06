# State management and automatic card-tier fees

Phase 35 adds the client state contract and the card-tier fee behavior needed by the application shell. Zustand stores under `src/stores/` are client-only hooks; `src/providers/AppProviders` is represented by `src/providers/app-providers.tsx` and hydrates trusted server-provided snapshots once. A store is a rendering convenience, not an authorization boundary.

## Zustand stores and providers

The stores cover the Phase 35 shell domains:

- `useAuthStore` holds the resolved session and active company ID.
- `useCompanyStore` keeps the allowed company list and refuses an active-company selection that is not in that list.
- `useSubscriptionStore` holds the current subscription and plan snapshot.
- `useBrandingStore` and `useThemeStore` hold tenant branding and light/dark/system preference.
- `useNotificationStore` upserts, reads, removes, and bounds in-app notifications while maintaining unread count.
- `useImpersonationStore` exposes the server-issued read-only impersonation session for the banner.
- `usePlatformStore` holds maintenance and announcement-bar state.
- `useAppStore` tracks hydration and responsive navigation state.

`AppProviders` accepts initial snapshots from a server component and hydrates them once on the client. It does not fetch credentials, decide entitlements, switch tenants without membership, or authorize a mutation. All server actions and route handlers must re-check the session, tenant, role, entitlement, and impersonation guard.

## Automatic card-tier pricing

`src/lib/mor/card-fees.ts` classifies only trusted gateway metadata; a browser request cannot choose a cheaper tier. The two built-in configurable tiers are:

| Tier                              | Classification                                                                                     | Default platform fee |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------- |
| `domestic_us_standard`            | Issuing country is `US`, provider card level is `standard`, and the card is not corporate          | 2.7% + USD 0.25      |
| `premium_international_corporate` | Any non-US card, provider level `premium` or `corporate`, a corporate card, or incomplete metadata | 3.7% + USD 0.25      |

Incomplete card metadata uses the premium/international/corporate tier rather than silently undercharging. The classification is derived after the official gateway response has been verified, never from client-submitted card fields.

`calculateAutomaticCardFee` resolves the company override for that tier first, then the active platform row, then the versioned built-in default. `calculatePlatformFee` snapshots the selected `cardFeeTier`, rate, fixed amount, currency, and charged amount. The fee engine is therefore automatic for every payment and still configurable by a super_admin: editing the active `platform_fee_rules` row for a tier changes the next payment in that tier; historical fee snapshots are not rewritten.

Migration `00168_platform_fee_card_tiers.sql` adds `platform_fee_tier` and permits one rule name per tier per platform/company scope. The default rows are deliberately versioned fallback configuration, while database rows remain authoritative for super-admin changes.

## Verification

`scripts/verify-phase35.ts` checks US standard, international, and corporate classification, the default 2.7% and 3.7% calculations, a super-admin premium-tier override, and the app/theme/platform store actions. Run `npm run verify:phase35`.
