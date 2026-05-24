'use client';

import { useEffect } from 'react';

export default function ServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Register asynchronously after first paint
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed', err);
      });
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
