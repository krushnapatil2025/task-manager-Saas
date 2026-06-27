// ═══════════════════════════════════════════════════════════════════════════
// browserNotify.js — WhatsApp-style browser push notifications
// Uses the Web Notifications API (zero dependencies).
// ═══════════════════════════════════════════════════════════════════════════

const APP_NAME   = 'TaskFlow';
const APP_ICON   = '/icons/icon-192x192.png'; // PWA icon path

// ── Permission management ────────────────────────────────────────────────────

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission() {
  if (!notificationsSupported()) return 'denied';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Ask the browser for notification permission.
 * Safe to call on user interaction (click).
 * Returns 'granted' | 'denied' | 'default'.
 */
export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied')  return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return 'denied';
  }
}

// ── Show a browser notification ──────────────────────────────────────────────

/**
 * Show a WhatsApp-style browser notification.
 *
 * @param {object} opts
 * @param {string} opts.title       - Bold heading (e.g. "Krushna")
 * @param {string} opts.body        - Message preview text
 * @param {string} [opts.icon]      - Avatar URL or fallback to app icon
 * @param {string} [opts.tag]       - Tag groups: same tag = replaces previous notification
 * @param {string} [opts.navigateTo]- URL to open when notification is clicked
 */
export function showBrowserNotification({ title, body, icon, tag, navigateTo }) {
  if (!notificationsSupported()) return;
  if (Notification.permission !== 'granted') return;

  // If the user already has the tab focused, skip the popup
  if (document.visibilityState === 'visible') return;

  try {
    const notif = new Notification(title, {
      body:    body  || '',
      icon:    icon  || APP_ICON,
      badge:   APP_ICON,
      tag:     tag   || 'taskflow-msg',
      renotify: true,
      silent:  true,   // suppress OS system sound — app plays its own sound
    });

    // Click → focus this tab and navigate to the correct chat room
    notif.onclick = () => {
      window.focus();
      if (navigateTo) {
        window.location.href = navigateTo;
      }
      notif.close();
    };

    // Auto-close after 6 seconds (like WhatsApp)
    setTimeout(() => notif.close(), 6000);
  } catch (err) {
    console.warn('Browser notification error:', err);
  }
}
