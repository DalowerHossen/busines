// src/lib/supabase/index.ts
// Keep this barrel browser-safe. The server, middleware and service-role
// factories are imported from their own modules on purpose, so a Client
// Component cannot accidentally pull a server-only module into its bundle.
export { getBrowserSupabaseClient } from './client';
export type { BrowserSupabaseClient } from './client';
export { subscribeToCompanyChanges } from './realtime';
export type { TenantRealtimeEvent } from './realtime';
