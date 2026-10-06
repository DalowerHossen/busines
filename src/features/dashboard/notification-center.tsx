'use client';

import Link from 'next/link';
import {
  Bell,
  Check,
  CheckCircle2,
  CreditCard,
  CircleAlert,
  FileCheck2,
  Info,
  Package,
  ShieldCheck,
  Trash2,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Notification, NotificationType } from '@/types/notification';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { EmptyState } from '@/components/ui/empty-state';
import { useNotificationStore } from '@/stores';

export function NotificationCenter({
  initialNotifications,
}: {
  /** Notifications read on the server for the signed in account. */
  readonly initialNotifications: readonly Notification[];
}): ReactNode {
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const upsert = useNotificationStore((state) => state.upsert);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const remove = useNotificationStore((state) => state.remove);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (useNotificationStore.getState().notifications.length === 0) {
      initialNotifications.forEach((notification) => upsert(notification));
    }
  }, [initialNotifications, upsert]);

  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => filter === 'all' || notification.readAt === null),
    [filter, notifications]
  );

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
            <Bell className="h-4 w-4" aria-hidden="true" />
            Workspace updates
          </div>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.045em]">
            Notifications
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Keep up with payments, client activity, and the next action that needs your attention.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={unreadCount === 0}
          leftIcon={<Check className="h-4 w-4" aria-hidden="true" />}
          onClick={markAllRead}
        >
          Mark all as read
        </Button>
      </header>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-4 border-b border-border">
          <CardTitle className="text-base">Your updates</CardTitle>
          <div className="flex items-center gap-2" role="group" aria-label="Notification filter">
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
              All <span className="text-muted-foreground">{notifications.length}</span>
            </FilterButton>
            <FilterButton active={filter === 'unread'} onClick={() => setFilter('unread')}>
              Unread <span className="text-muted-foreground">{unreadCount}</span>
            </FilterButton>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {visibleNotifications.length > 0 ? (
            <div className="divide-y divide-border">
              {visibleNotifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onRead={() => markRead(notification.id)}
                  onRemove={() => remove(notification.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              className="m-5"
              icon={CheckCircle2}
              title={filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}
              description={
                filter === 'unread'
                  ? 'New payment and workspace updates will appear here.'
                  : 'When something important happens in your workspace, it will appear here.'
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationRow({
  notification,
  onRead,
  onRemove,
}: {
  readonly notification: Notification;
  readonly onRead: () => void;
  readonly onRemove: () => void;
}): ReactNode {
  const unread = notification.readAt === null;
  return (
    <div
      className={`group flex gap-4 p-5 transition-colors hover:bg-surface-muted/50 sm:p-6 ${unread ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''}`}
    >
      <NotificationIcon type={notification.type} unread={unread} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {notification.linkPath ? (
                <Link
                  href={notification.linkPath}
                  onClick={onRead}
                  className="text-sm font-semibold text-foreground hover:text-brand-700 dark:hover:text-brand-300"
                >
                  {notification.title}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-foreground">{notification.title}</p>
              )}
              {unread ? <Badge variant="brand">New</Badge> : null}
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.body}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatNotificationTime(notification.createdAt)}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {unread ? (
            <Button
              variant="quiet"
              size="sm"
              onClick={onRead}
              leftIcon={<Check className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Mark read
            </Button>
          ) : null}
          <Button
            variant="quiet"
            size="sm"
            onClick={onRemove}
            leftIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

function NotificationIcon({
  type,
  unread,
}: {
  readonly type: NotificationType;
  readonly unread: boolean;
}): ReactNode {
  const Icon = getNotificationIcon(type);
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${unread ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200' : 'bg-surface-muted text-muted-foreground'}`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  readonly active: boolean;
  readonly children: ReactNode;
  readonly onClick: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      className={`min-h-9 rounded-md px-3 text-xs font-semibold transition-colors ${active ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function getNotificationIcon(type: NotificationType): LucideIcon {
  switch (type) {
    case 'invoice_paid':
    case 'payment_failed':
      return type === 'invoice_paid' ? CheckCircle2 : CircleAlert;
    case 'invoice_overdue':
    case 'security_alert':
      return CircleAlert;
    case 'estimate_approved':
    case 'estimate_declined':
      return FileCheck2;
    case 'team_invitation':
      return Users;
    case 'kyc_status_changed':
      return ShieldCheck;
    case 'payment_received':
    case 'payout_processed':
      return WalletCards;
    case 'low_stock':
      return Package;
    case 'subscription_changed':
      return CreditCard;
    case 'system_announcement':
      return Info;
    default:
      return Info;
  }
}

function formatNotificationTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Recently';
  const hours = Math.max(0, Math.floor((Date.now() - timestamp) / 3_600_000));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(timestamp);
}
