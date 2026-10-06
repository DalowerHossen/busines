'use client';

import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface BrandingSnapshot {
  readonly companyName: string;
  readonly logoProviderFileId: string | null;
  readonly primaryColor: string;
  readonly accentColor: string;
}

export interface BrandingStore {
  readonly branding: BrandingSnapshot | null;
  setBranding: (branding: BrandingSnapshot | null) => void;
  clearBranding: () => void;
}

export interface ThemeStore {
  readonly theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

export const useBrandingStore = create<BrandingStore>((set) => ({
  branding: null,
  setBranding: (branding) => set({ branding }),
  clearBranding: () => set({ branding: null }),
}));

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: 'system',
  setTheme: (theme) => set({ theme }),
}));
