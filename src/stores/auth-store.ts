'use client';

import { create } from 'zustand';
import type { AuthSession } from '@/types/auth';

export interface AuthStore {
  readonly session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  setActiveCompanyId: (companyId: AuthSession['activeCompanyId']) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  setActiveCompanyId: (activeCompanyId) =>
    set((state) => (state.session ? { session: { ...state.session, activeCompanyId } } : state)),
  clearSession: () => set({ session: null }),
}));
