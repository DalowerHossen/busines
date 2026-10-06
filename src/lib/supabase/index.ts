// src/lib/supabase/index.ts
// Keep this barrel browser-safe. Server and admin factories are intentionally
// imported from ./server and ./admin directly so a Client Component cannot
// accidentally pull a server-only module into its bundle.
export { createSupabaseBrowserClient } from './browser';
export { subscribeToCompanyChanges } from './realtime';
export type { TenantRealtimeEvent } from './realtime';
