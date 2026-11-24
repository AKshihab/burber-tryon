import type { TokenView } from './api.ts';

/** How often the token screen asks the server where the queue is. */
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

/** Show a system notification if the user allowed them. Never throws: the in-app banner is the fallback. */
export function sendTurnNotification(token: TokenView): void {
  if (notificationPermission() !== 'granted') return;
  try {
    new Notification('Your turn is close', {
      body: `Token ${token.number}: about ${token.etaMinutes} min to go.`,
    });
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
}
