// src/features/dashboard/index.ts
// Public surface of the dashboard feature. The page itself composes the
// query and the shared cards directly, so only the interactive notification
// centre is re-exported here.

export { NotificationCenter } from './notification-center';
export { loadDashboardOverview } from './queries/overview';
export type { DashboardInvoice, DashboardOverview } from './queries/overview';
