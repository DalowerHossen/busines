'use client';

import { create } from 'zustand';
import type { Notification } from '@/types/notification';
import type { ISODateString } from '@/types/core';

const MAX_NOTIFICATIONS = 100;

export interface NotificationStore {
  readonly notifications: readonly Notification[];
  readonly unreadCount: number;
  upsert: (notification: Notification) => void;
  markRead: (notificationId: Notification['id']) => void;
  markAllRead: () => void;
  remove: (notificationId: Notification['id']) => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  upsert: (notification) =>
    set((state) => {
      const withoutExisting = state.notifications.filter((item) => item.id !== notification.id);
      const notifications = [notification, ...withoutExisting].slice(0, MAX_NOTIFICATIONS);
      return { notifications, unreadCount: countUnread(notifications) };
    }),
  markRead: (notificationId) =>
    set((state) => {
      const notifications = state.notifications.map((notification) =>
        notification.id === notificationId && notification.readAt === null
          ? { ...notification, readAt: nowIsoDate() }
          : notification
      );
      return { notifications, unreadCount: countUnread(notifications) };
    }),
  markAllRead: () =>
    set((state) => {
      const readAt = nowIsoDate();
      const notifications = state.notifications.map((notification) =>
        notification.readAt === null ? { ...notification, readAt } : notification
      );
      return { notifications, unreadCount: 0 };
    }),
  remove: (notificationId) =>
    set((state) => {
      const notifications = state.notifications.filter(
        (notification) => notification.id !== notificationId
      );
      return { notifications, unreadCount: countUnread(notifications) };
    }),
  clear: () => set({ notifications: [], unreadCount: 0 }),
}));

function nowIsoDate(): ISODateString {
  return new Date().toISOString() as ISODateString;
}

function countUnread(notifications: readonly Notification[]): number {
  return notifications.reduce(
    (count, notification) => count + (notification.readAt === null ? 1 : 0),
    0
  );
}
