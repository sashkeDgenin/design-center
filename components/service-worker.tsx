"use client";

import { useEffect } from "react";

/**
 * Registers the service worker so the app launches instantly from the home screen.
 *
 * Registration failing is not worth surfacing: the app works perfectly without it,
 * and a private window or a browser with workers disabled is not a problem to solve.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    // After load, so registration never competes with the first paint.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
