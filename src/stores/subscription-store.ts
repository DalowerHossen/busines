'use client';

import { create } from 'zustand';
import type { Plan, Subscription } from '@/types/subscription';

export interface SubscriptionStore {
  readonly subscription: Subscription | null;
  readonly plan: Plan | null;
  setSnapshot: (input: {
    readonly subscription: Subscription | null;
    readonly plan: Plan | null;
  }) => void;
  clearSnapshot: () => void;
}

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  subscription: null,
  plan: null,
  setSnapshot: (input) => set(input),
  clearSnapshot: () => set({ subscription: null, plan: null }),
}));
