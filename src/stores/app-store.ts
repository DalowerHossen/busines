'use client';

import { create } from 'zustand';

export interface AppStore {
  readonly isHydrated: boolean;
  readonly isSidebarOpen: boolean;
  readonly isMobileNavOpen: boolean;
  markHydrated: () => void;
  setSidebarOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  isHydrated: false,
  isSidebarOpen: true,
  isMobileNavOpen: false,
  markHydrated: () => set({ isHydrated: true }),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setMobileNavOpen: (isMobileNavOpen) => set({ isMobileNavOpen }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}));
