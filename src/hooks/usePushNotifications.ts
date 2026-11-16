import { useCallback, useEffect, useState } from 'react';
import type { CareReminder } from '../types';

const PUSH_PREF_KEY = 'traiheo_push_enabled';
const LAST_NOTIFIED_DATE_KEY = 'traiheo_last_push_date';

export function usePushNotifications(reminders: CareReminder[]) {
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied'
  );
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return true;
    const saved = localStorage.getItem(PUSH_PREF_KEY);
    return saved === null ? true : saved === 'true';
  });

  const sendPushNotification = useCallback(
    async (title: string, body: string) => {
      if (!supported || Notification.permission !== 'granted') return false;
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          if (reg && reg.showNotification) {
            await reg.showNotification(title, {
              body,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: 'traiheo-care-reminder',
            });
            return true;
          }
        }
        new Notification(title, { body, icon: '/pwa-192x192.png' });
        return true;
      } catch {
        try {
          new Notification(title, { body });
          return true;
        } catch {
          return false;
        }
      }
    },
    [supported]
  );

  const requestPermission = useCallback(async () => {
    if (!supported) return 'denied' as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      setEnabled(true);
      localStorage.setItem(PUSH_PREF_KEY, 'true');
      await sendPushNotification(
        'TrạiHeo — Đã bật thông báo đẩy',
        'Hệ thống sẽ nhắc nhở lịch phối giống, đẻ con, tiêm phòng và cảnh báo tồn kho định kỳ.'
      );
    }
    return result;
  }, [supported, sendPushNotification]);

  const toggleEnabled = useCallback((next: boolean) => {
    setEnabled(next);
    localStorage.setItem(PUSH_PREF_KEY, String(next));
  }, []);

  // Periodic automatic check for urgent care reminders (overdue / today / critical)
  useEffect(() => {
    if (!supported || permission !== 'granted' || !enabled) return;
    const urgent = reminders.filter(
      (r) => r.urgency === 'overdue' || r.urgency === 'today' || r.urgency === 'warning'
    );
    if (urgent.length === 0) return;

    const todayKey = new Date().toISOString().slice(0, 10);
    const lastNotified = localStorage.getItem(LAST_NOTIFIED_DATE_KEY);
    if (lastNotified === todayKey) return;

    const top = urgent[0];
    const summary =
      urgent.length === 1
        ? `${top.title} — ${top.subtitle}`
        : `${top.title} và ${urgent.length - 1} việc cần xử lý hôm nay.`;

    localStorage.setItem(LAST_NOTIFIED_DATE_KEY, todayKey);
    void sendPushNotification('Nhắc nhở chăm sóc trang trại', summary);
  }, [supported, permission, enabled, reminders, sendPushNotification]);

  const triggerManualReminderCheck = useCallback(async () => {
    if (!supported) return false;
    if (permission !== 'granted') {
      const res = await requestPermission();
      if (res !== 'granted') return false;
    }
    const urgent = reminders.filter(
      (r) => r.urgency === 'overdue' || r.urgency === 'today' || r.urgency === 'warning'
    );
    if (urgent.length === 0) {
      return sendPushNotification(
        'TrạiHeo — Lịch chăm sóc định kỳ',
        'Hiện không có lịch tiêm phòng hoặc cảnh báo quá hạn. Đàn heo ổn định.'
      );
    }
    return sendPushNotification(
      `Nhắc nhở (${urgent.length} việc cần lưu ý)`,
      `${urgent[0].title}: ${urgent[0].subtitle}`
    );
  }, [supported, permission, requestPermission, reminders, sendPushNotification]);

  return {
    supported,
    permission,
    enabled,
    toggleEnabled,
    requestPermission,
    sendPushNotification,
    triggerManualReminderCheck,
  };
}
