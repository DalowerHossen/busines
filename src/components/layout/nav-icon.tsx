// src/components/layout/nav-icon.tsx
// Maps a navigation entry to its icon, so the navigation configuration stays
// free of components.

import {
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  FolderOpen,
  Handshake,
  LayoutDashboard,
  Mail,
  Package,
  PiggyBank,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  Code2,
  Landmark,
  Gift,
  PenLine,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import type { NavIconName } from '@/config/navigation';

const ICONS: Readonly<Record<NavIconName, LucideIcon>> = {
  dashboard: LayoutDashboard,
  invoices: FileText,
  estimates: FileText,
  clients: Users,
  products: Package,
  payments: Wallet,
  payouts: PiggyBank,
  billing: CreditCard,
  subscriptions: RefreshCw,
  expenses: Receipt,
  reports: BarChart3,
  settings: Settings,
  team: Users,
  messages: Mail,
  admin: ShieldCheck,
  affiliate: Handshake,
  reseller: Building2,
  accountant: BarChart3,
  marketplace: Store,
  developers: Code2,
  banking: Landmark,
  contracts: PenLine,
  loyalty: Gift,
  files: FolderOpen,
};

export interface NavIconProps {
  /** Name recorded against the navigation entry. */
  name: NavIconName;
  /** Extra classes, usually the size. */
  className?: string;
}

/**
 * Renders the icon for a navigation entry.
 *
 * @param props Icon name and classes.
 * @returns The rendered icon.
 */
export function NavIcon({ name, className }: NavIconProps) {
  const Icon = ICONS[name];

  return <Icon aria-hidden="true" className={className} />;
}
