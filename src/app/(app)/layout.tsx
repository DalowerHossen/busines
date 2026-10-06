import type { ReactNode } from 'react';
import { AppProviders } from '@/providers/app-providers';
import { AppShell } from '@/components/layouts';
import {
  DASHBOARD_NOTIFICATIONS,
  DASHBOARD_SEARCH_DOCUMENTS,
} from '@/features/dashboard/dashboard-data';

export default function ApplicationLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return (
    <AppProviders initialState={{ notifications: DASHBOARD_NOTIFICATIONS }}>
      <AppShell
        role="owner"
        brandName="KD SOLUTION IT"
        companyName="Northstar Studio"
        userName="Alex Morgan"
        userEmail="alex@northstar.example"
        searchDocuments={DASHBOARD_SEARCH_DOCUMENTS}
        searchActor={{
          userId: 'user-owner-demo',
          role: 'owner',
          companyIds: ['company-demo'],
        }}
        searchCompanyId="company-demo"
      >
        {children}
      </AppShell>
    </AppProviders>
  );
}
