'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Company } from '@/types/auth';
import { useCompanyStore } from '@/stores';

export interface CompanyContextValue {
  readonly companies: readonly Company[];
  readonly activeCompany: Company | null;
  readonly activeCompanyId: Company['id'] | null;
  readonly isReady: boolean;
  readonly selectCompany: (companyId: Company['id']) => boolean;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({
  children,
  initialCompanies,
}: {
  readonly children: ReactNode;
  readonly initialCompanies?: readonly Company[];
}): ReactNode {
  const companies = useCompanyStore((state) => state.companies);
  const activeCompanyId = useCompanyStore((state) => state.activeCompanyId);
  const setCompanies = useCompanyStore((state) => state.setCompanies);
  const selectCompany = useCompanyStore((state) => state.selectCompany);
  const [isReady, setIsReady] = useState(initialCompanies !== undefined);

  useEffect(() => {
    if (initialCompanies !== undefined) setCompanies(initialCompanies);
    setIsReady(true);
  }, [initialCompanies, setCompanies]);

  const activeCompany = useMemo(
    () => companies.find((company) => company.id === activeCompanyId) ?? null,
    [activeCompanyId, companies]
  );
  const value = useMemo<CompanyContextValue>(
    () => ({ companies, activeCompany, activeCompanyId, isReady, selectCompany }),
    [activeCompany, activeCompanyId, companies, isReady, selectCompany]
  );
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyContextValue {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used inside CompanyProvider.');
  return context;
}
