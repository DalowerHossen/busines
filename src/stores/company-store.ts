'use client';

import { create } from 'zustand';
import type { Company } from '@/types/auth';

export interface CompanyStore {
  readonly companies: readonly Company[];
  readonly activeCompanyId: Company['id'] | null;
  setCompanies: (companies: readonly Company[]) => void;
  selectCompany: (companyId: Company['id']) => boolean;
  clearCompanies: () => void;
}

export const useCompanyStore = create<CompanyStore>((set, get) => ({
  companies: [],
  activeCompanyId: null,
  setCompanies: (companies) => {
    const activeCompanyId = get().activeCompanyId;
    set({
      companies,
      activeCompanyId:
        activeCompanyId && companies.some((company) => company.id === activeCompanyId)
          ? activeCompanyId
          : (companies[0]?.id ?? null),
    });
  },
  selectCompany: (companyId) => {
    if (!get().companies.some((company) => company.id === companyId)) return false;
    set({ activeCompanyId: companyId });
    return true;
  },
  clearCompanies: () => set({ companies: [], activeCompanyId: null }),
}));
