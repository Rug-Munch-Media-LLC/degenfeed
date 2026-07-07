'use client';

import { useEffect } from 'react';

export function ErrorTracker() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      console.error('[DegenFeed Error]', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      console.error('[DegenFeed Unhandled Promise]', { reason: event.reason });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
