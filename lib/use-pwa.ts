"use client";

import { useEffect, useState } from "react";

export function usePwa() {
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if ("serviceWorker" in navigator && !swRegistered) {
      navigator.serviceWorker.register("/sw.js").then(() => {
        setSwRegistered(true);
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [swRegistered]);

  return { isOnline, isStandalone, swRegistered };
}
