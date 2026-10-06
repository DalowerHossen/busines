'use client';

import { create } from 'zustand';
import type { ImpersonationSession } from '@/lib/core';

export interface ImpersonationStore {
  readonly session: ImpersonationSession | null;
  setSession: (session: ImpersonationSession | null) => void;
  endSession: () => void;
}

export const useImpersonationStore = create<ImpersonationStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  endSession: () => set({ session: null }),
}));
