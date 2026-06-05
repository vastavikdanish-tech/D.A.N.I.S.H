"use client";

import { useEffect, useState } from "react";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  }
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    const installedHandler = () => {
      setInstalled(true);
      setShowPrompt(false);
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);
    window.addEventListener("appinstalled", installedHandler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  if (!showPrompt || installed) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 max-w-md mx-auto">
      <div className="rounded-2xl border border-cyan-electric/20 bg-black/90 backdrop-blur-xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-cyan-electric/10 border border-cyan-electric/30">
            <span className="text-lg font-bold text-cyan-electric">D</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Install D.A.N.I.S.H</p>
            <p className="text-xs text-muted-foreground mt-0.5">Add to your home screen for the full AI OS experience</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="flex-1 rounded-xl bg-cyan-electric/15 border border-cyan-electric/30 py-2.5 text-sm font-medium text-cyan-soft hover:bg-cyan-electric/25 transition"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-muted-foreground hover:text-white transition"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
