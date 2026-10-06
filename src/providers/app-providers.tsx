'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { AuthSession, Company } from '@/types/auth';
import type { Notification } from '@/types/notification';
import type { Plan, Subscription } from '@/types/subscription';
import {
  useAppStore,
  useAuthStore,
  useBrandingStore,
  useCompanyStore,
  useImpersonationStore,
  useNotificationStore,
  usePlatformStore,
  useSubscriptionStore,
  useThemeStore,
} from '@/stores';
import type { BrandingSnapshot, ThemePreference } from '@/stores';
import type { ImpersonationSession } from '@/lib/core';
import type { AnnouncementState, MaintenanceState } from '@/stores/platform-store';
import { CompanyProvider } from './company-provider';

export interface AppProviderInitialState {
  readonly session?: AuthSession | null;
  readonly companies?: readonly Company[];
  readonly subscription?: Subscription | null;
  readonly plan?: Plan | null;
  readonly branding?: BrandingSnapshot | null;
  readonly theme?: ThemePreference;
  readonly maintenance?: MaintenanceState;
  readonly announcement?: AnnouncementState | null;
  readonly impersonation?: ImpersonationSession | null;
  readonly notifications?: readonly Notification[];
}

export function AppProviders({
  children,
  initialState,
}: {
  readonly children: ReactNode;
  readonly initialState?: AppProviderInitialState;
}): ReactNode {
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (initialState?.session !== undefined)
      useAuthStore.getState().setSession(initialState.session);
    if (initialState?.companies !== undefined)
      useCompanyStore.getState().setCompanies(initialState.companies);
    if (initialState?.subscription !== undefined || initialState?.plan !== undefined) {
      useSubscriptionStore.getState().setSnapshot({
        subscription: initialState.subscription ?? null,
        plan: initialState.plan ?? null,
      });
    }
    if (initialState?.branding !== undefined)
      useBrandingStore.getState().setBranding(initialState.branding);
    if (initialState?.theme !== undefined) useThemeStore.getState().setTheme(initialState.theme);
    if (initialState?.maintenance !== undefined)
      usePlatformStore.getState().setMaintenance(initialState.maintenance);
    if (initialState?.announcement !== undefined)
      usePlatformStore.getState().setAnnouncement(initialState.announcement);
    if (initialState?.impersonation !== undefined)
      useImpersonationStore.getState().setSession(initialState.impersonation);
    if (initialState?.notifications !== undefined) {
      const notificationStore = useNotificationStore.getState();
      notificationStore.clear();
      initialState.notifications.forEach((notification) => notificationStore.upsert(notification));
    }
    useAppStore.getState().markHydrated();
  }, [initialState]);
  return <CompanyProvider initialCompanies={initialState?.companies}>{children}</CompanyProvider>;
}
