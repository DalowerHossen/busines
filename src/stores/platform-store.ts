'use client';

import { create } from 'zustand';

export interface MaintenanceState {
  readonly enabled: boolean;
  readonly message: string | null;
  readonly endsAt: string | null;
}

export interface AnnouncementState {
  readonly id: string;
  readonly message: string;
  readonly href: string | null;
  readonly severity: 'info' | 'success' | 'warning' | 'critical';
  readonly dismissible: boolean;
}

export interface PlatformStore {
  readonly maintenance: MaintenanceState;
  readonly announcement: AnnouncementState | null;
  setMaintenance: (maintenance: MaintenanceState) => void;
  setAnnouncement: (announcement: AnnouncementState | null) => void;
  clearAnnouncement: () => void;
}

export const usePlatformStore = create<PlatformStore>((set) => ({
  maintenance: { enabled: false, message: null, endsAt: null },
  announcement: null,
  setMaintenance: (maintenance) => set({ maintenance }),
  setAnnouncement: (announcement) => set({ announcement }),
  clearAnnouncement: () => set({ announcement: null }),
}));
