import type { TokenView } from './api.ts';

/** How often the app asks the server where the queue is. */
export const POLL_MS = 15000;

/** True when this token has just come within the alert window and has not been announced yet. */
export function shouldAlert(token: TokenView | null, alertedNumber: number | null): boolean {
  return token !== null && token.notifySoon && token.number !== alertedNumber;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  try {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  } catch {
    return 'unsupported';
  }
}

/**
 * Show a system notification if the user allowed them. Never throws: the in-app banner is the fallback.
 * Desktop browsers let a page build a Notification directly; Chrome on Android refuses and only
 * allows it through a service worker (public/sw.js), so that is tried second.
 */
export function sendTurnNotification(token: TokenView): void {
  if (notificationPermission() !== 'granted') return;
  const title = 'Your turn is close';
  const options = { body: `Token ${token.number}: about ${token.etaMinutes} min to go.` };
  try {
    new Notification(title, options);
    return;
  } catch {
    /* fall through to the service worker */
  }
  try {
    navigator.serviceWorker?.ready
      .then((registration) => registration.showNotification(title, options))
      .catch(() => {
        /* no notification on this device; the banner still shows */
      });
  } catch {
    /* no service worker support */
  }
}

/** Register the service worker that lets phones show the turn notification. Safe to call anywhere. */
export function registerNotificationWorker(): void {
  try {
    void navigator.serviceWorker?.register('/sw.js').catch(() => {
      /* not available (http, private mode): notifications fall back to the banner */
    });
  } catch {
    /* no service worker support */
  }
}
