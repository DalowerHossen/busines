// src/features/clients/index.ts
// Public surface of the clients feature. Pages live under
// src/app/(app)/dashboard/clients and compose these queries, actions and
// validators directly, so only the shared contracts are re-exported here.

export { createClient } from './actions/create-client';
export { deleteClient } from './actions/delete-client';
export { restoreClient } from './actions/restore-client';
export { setClientStatus } from './actions/set-client-status';
export { updateClient } from './actions/update-client';
export { getClient, getClientBillingSummary } from './queries/get-client';
export { countClientsByStatus, listClients } from './queries/list-clients';
export type { ClientListFilters, ClientSummary } from './types';
