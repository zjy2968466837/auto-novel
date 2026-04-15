import { detectPlatform } from './detect';
import type {
  NotifyPayload,
  PlatformAdapter,
  SharePayload,
  PlatformKind,
} from './types';

const triggerDownload = (filename: string, blob: Blob) => {
  const el = document.createElement('a');
  el.href = URL.createObjectURL(blob);
  el.target = '_blank';
  el.download = filename;
  el.click();
  URL.revokeObjectURL(el.href);
};

const createAdapter = (kind: PlatformKind): PlatformAdapter => ({
  kind,
  async downloadFile(filename: string, blob: Blob) {
    triggerDownload(filename, blob);
  },
  async share(payload: SharePayload) {
    if (!navigator.share) {
      return false;
    }
    try {
      await navigator.share(payload);
      return true;
    } catch {
      return false;
    }
  },
  async notify(payload: NotifyPayload) {
    if (!('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      new Notification(payload.title, { body: payload.body });
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(payload.title, { body: payload.body });
        return true;
      }
    }
    return false;
  },
  async exportLog(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    triggerDownload(filename, blob);
  },
  runInBackground<T>(task: () => Promise<T>) {
    return task();
  },
});

const adapter = createAdapter(detectPlatform());

export const platformAdapter = adapter;
