# Role-aware application layouts

Phase 40 composes the Phase 38 and Phase 39 primitives into an authenticated application shell under `src/components/layouts/`.

## Layout surfaces

- `AppShell` composes the desktop `Sidebar`, sticky `Topbar`, responsive `MobileNav`, `Breadcrumb`, and `CommandPalette` while using the Phase 35 app store for sidebar/mobile state.
- `Sidebar` uses `getNavItemsForRole` from the central navigation map, resolves the configured Lucide icon names through a safe registry, supports collapse/expand, preserves nested admin navigation, and marks the current route.
- `Topbar` exposes responsive navigation, command-palette and notification actions, account identity, and the current breadcrumb trail.
- `MobileNav` reuses the Sheet primitive and closes after navigation.
- `Breadcrumb` derives labels from the same role-filtered navigation tree and handles dynamic trailing route segments without inventing authorization.
- `CommandPalette` searches only the destinations visible to the supplied role and closes after selection.

## Authorization boundary

Role filtering is a presentation and discoverability layer only. `AppShell` takes a server-resolved `AccountRole`; it does not grant access. Route handlers, server actions, Supabase RLS, tenant membership, and capability checks remain authoritative. A hidden navigation item is not a security control.

The navigation registry remains the single source of truth for labels, URLs, icon names, nested items, and role visibility. QR business cards are not introduced. No client-side code calls a provider or derives entitlement state from navigation visibility.

Run `npm run verify:phase40` for deterministic role-filtering, breadcrumb, flattening, and icon-registry coverage.
