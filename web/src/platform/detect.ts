import { Capacitor } from '@capacitor/core';

import type { PlatformKind } from './types';

const tauri = () =>
  typeof window !== 'undefined' &&
  '__TAURI_INTERNALS__' in
    (window as Window & { __TAURI_INTERNALS__?: unknown });

export const detectPlatform = (): PlatformKind => {
  if (tauri()) {
    return 'desktop';
  }
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    return 'android';
  }
  return 'web';
};

export const getApiBaseUrl = () => {
  const mode = import.meta.env.VITE_API_MODE;
  const override = import.meta.env.VITE_API_BASE_URL;
  if (override) {
    return override;
  }
  if (mode === 'native') {
    return import.meta.env.DEV ? '/api' : 'https://n.novelia.cc/api';
  }
  return '/api';
};
