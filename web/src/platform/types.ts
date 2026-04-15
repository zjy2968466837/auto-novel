export type PlatformKind = 'web' | 'desktop' | 'android';

export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
}

export interface NotifyPayload {
  title: string;
  body?: string;
}

export interface PlatformAdapter {
  readonly kind: PlatformKind;
  downloadFile(filename: string, blob: Blob): Promise<void>;
  share(payload: SharePayload): Promise<boolean>;
  notify(payload: NotifyPayload): Promise<boolean>;
  exportLog(filename: string, content: string): Promise<void>;
  runInBackground<T>(task: () => Promise<T>): Promise<T>;
}
