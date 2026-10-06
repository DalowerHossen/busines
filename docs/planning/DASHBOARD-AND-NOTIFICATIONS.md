# Dashboard, global search, and notification center

Phase 46 adds the authenticated application shell's first product surface: `/dashboard` and `/notifications`. The route layout composes the existing role-aware `AppShell`, sidebar, mobile navigation, top bar, command palette, and notification store. The current route uses an owner-shaped preview state until the later server session and repository wiring phases connect real Supabase data; the component contracts accept data and actor inputs rather than hiding that wiring behind browser-only mocks.

## Dashboard overview

`src/features/dashboard/dashboard-page.tsx` renders responsive summary cards, a six-month revenue visualization, cash position, recent invoice table, and an action center. Every visible action has a destination, the invoice table remains usable at narrow widths through horizontal scrolling, and the chart includes screen-reader text and per-bar labels. `DashboardData` keeps display data separate from the component so a server route can later replace it with authorized repository results.

## Global search and command palette

`searchGlobalDocuments` remains the server-safe tenant-scoped search boundary. The command palette now searches visible navigation and supplied workspace documents together. `Ctrl+K` and `Command+K` open it, Escape closes it through the dialog primitive, and record results retain their sanitized relative links. The palette never widens a tenant search: it requires an actor, a permitted company ID, and the existing core search boundary.

## Notification center

`NotificationCenter` uses the existing bounded `useNotificationStore` for unread counts, mark-read, mark-all-read, remove, and all/unread filtering. The top bar reads the store's unread count and links to `/notifications`. Notification rows preserve the notification's deep link, show type-specific accessible icons, expose a visible mobile action row, and use the existing English-only UI copy. Initial route data is an explicit provider input so later server hydration can replace the current preview records without changing the interaction contract.

## Verification

Run `npm run verify:phase46` for route/component presence, tenant search behavior, navigation and record search hooks, keyboard palette hooks, and notification state transitions. Run `npm run verify` and the production build as the general phase gate.
