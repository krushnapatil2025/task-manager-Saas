// ─────────────────────────────────────────────────────────────────────────────
// useSessionManager.js
//
// Rolling 6-hour idle session timeout engine.
//
// Strategy (mobile-safe):
//   ┌─ Every user interaction  → write Date.now() to localStorage
//   └─ Every 60s + app-resume  → read timestamp, if elapsed > 6h → logout
//
// Using a persistent timestamp (not setTimeout) ensures the check survives:
//   • Browser tab refresh
//   • Android/iOS app being backgrounded and killed by the OS
//   • Capacitor WebView lifecycle events
//
// Super Admins are EXEMPT from this timeout.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback, useState } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────
const SESSION_DURATION_MS  = 6 * 60 * 60 * 1000;  // 6 hours
const WARNING_THRESHOLD_MS = 5 * 60 * 1000;        // show warning 5 min before logout
const CHECK_INTERVAL_MS    = 30 * 1000;             // check every 30 seconds
const STORAGE_KEY          = 'strideo_last_activity';

// Activity events that reset the idle timer
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

/**
 * useSessionManager
 *
 * @param {object} options
 * @param {Function} options.onExpire   - Called when session expires. Should call clearUser() + redirect.
 * @param {boolean}  options.isActive   - True when a non-super-admin user is logged in.
 * @param {boolean}  options.isSuperAdmin - True for super admin users (exempt from timeout).
 *
 * @returns {{ showWarning: boolean, secondsLeft: number, extendSession: Function }}
 */
export const useSessionManager = ({ onExpire, isActive, isSuperAdmin }) => {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef   = useRef(null);
  const countdownRef  = useRef(null);
  const warningRef    = useRef(false); // tracks if warning is currently visible

  // ── Write current time to localStorage ──────────────────────────────────
  const stampActivity = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // localStorage may be unavailable in some private modes — fail silently
    }
  }, []);

  // ── Read timestamp from localStorage ────────────────────────────────────
  const getLastActivity = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? parseInt(raw, 10) : Date.now();
    } catch {
      return Date.now();
    }
  }, []);

  // ── Extend session (reset timer) ─────────────────────────────────────────
  const extendSession = useCallback(() => {
    stampActivity();
    setShowWarning(false);
    warningRef.current = false;
    // Clear any running countdown
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, [stampActivity]);

  // ── Start the 5-minute countdown shown in the warning modal ─────────────
  const startCountdown = useCallback((msRemaining) => {
    if (warningRef.current) return; // already showing
    warningRef.current = true;
    setShowWarning(true);
    setSecondsLeft(Math.floor(msRemaining / 1000));

    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Core session check ───────────────────────────────────────────────────
  const checkSession = useCallback(() => {
    const lastActivity = getLastActivity();
    const elapsed      = Date.now() - lastActivity;
    const remaining    = SESSION_DURATION_MS - elapsed;

    if (remaining <= 0) {
      // Session expired — logout immediately
      setShowWarning(false);
      if (countdownRef.current) clearInterval(countdownRef.current);
      onExpire();
      return;
    }

    if (remaining <= WARNING_THRESHOLD_MS) {
      // Within warning window — show modal if not already shown
      startCountdown(remaining);
    } else {
      // Still well within session — hide warning if visible
      if (warningRef.current) {
        setShowWarning(false);
        warningRef.current = false;
        if (countdownRef.current) clearInterval(countdownRef.current);
      }
    }
  }, [getLastActivity, onExpire, startCountdown]);

  // ── Activity handler — debounced via a ref flag ──────────────────────────
  const activityThrottleRef = useRef(false);
  const handleActivity = useCallback(() => {
    if (activityThrottleRef.current) return;
    activityThrottleRef.current = true;
    stampActivity();
    // If warning is showing, dismiss it (user is active)
    if (warningRef.current) {
      extendSession();
    }
    // Throttle: only write once per 10 seconds to avoid hammering localStorage
    setTimeout(() => { activityThrottleRef.current = false; }, 10_000);
  }, [stampActivity, extendSession]);

  // ── Main effect — starts when user is logged in as non-super-admin ───────
  useEffect(() => {
    if (!isActive || isSuperAdmin) {
      // Super admins bypass all timeout logic
      return;
    }

    // Stamp initial activity when session starts (e.g. after login)
    const existingStamp = localStorage.getItem(STORAGE_KEY);
    if (!existingStamp) stampActivity();

    // Immediately check on mount (catches expired sessions from background)
    checkSession();

    // Attach activity listeners
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true })
    );

    // Start periodic check
    intervalRef.current = setInterval(checkSession, CHECK_INTERVAL_MS);

    // Capacitor + browser visibility: re-check when app comes to foreground
    const handleVisibility = () => {
      if (!document.hidden) checkSession();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Capacitor App plugin — handles Android/iOS cold resume
    let capListener = null;
    const attachCapacitor = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        capListener = await CapApp.addListener('appStateChange', ({ isActive: appIsActive }) => {
          if (appIsActive) checkSession();
        });
      } catch {
        // Not running inside Capacitor — silently ignore
      }
    };
    attachCapacitor();

    return () => {
      // Cleanup all listeners and timers
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity)
      );
      document.removeEventListener('visibilitychange', handleVisibility);
      if (intervalRef.current)  clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (capListener)          capListener.remove();
    };
  }, [isActive, isSuperAdmin, checkSession, handleActivity, stampActivity]);

  return { showWarning, secondsLeft, extendSession };
};
