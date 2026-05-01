import { useEffect, useRef } from 'react';

/**
 * useAutoRefresh
 *
 * Calls `fetchFn` automatically on two triggers:
 *   1. Every `intervalMs` milliseconds (default 30 s)
 *   2. Whenever the user comes back to this browser tab (Page Visibility API)
 *
 * Smart pause: if the user is actively typing in any input, textarea, or select
 * the poll is skipped — no disruptive re-renders while filling forms.
 *
 * Usage:
 *   useAutoRefresh(fetchOrders);               // 30-second polling
 *   useAutoRefresh(fetchProducts, 60_000);     // 60-second polling
 */

// Returns true if the user is currently focused on a form element
const isUserTyping = () => {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  const isFormField = tag === 'input' || tag === 'textarea' || tag === 'select';
  const isContentEditable = el.isContentEditable;
  return isFormField || isContentEditable;
};

const useAutoRefresh = (fetchFn, intervalMs = 30_000) => {
  const fetchRef = useRef(fetchFn);
  useEffect(() => { fetchRef.current = fetchFn; }, [fetchFn]);

  useEffect(() => {
    // ── Interval polling — skip if user is typing ─────────────────────────
    const timer = setInterval(() => {
      if (!isUserTyping()) {
        fetchRef.current();
      }
    }, intervalMs);

    // ── Tab visibility refresh — skip if user is typing ───────────────────
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isUserTyping()) {
        fetchRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalMs]);
};

export default useAutoRefresh;
