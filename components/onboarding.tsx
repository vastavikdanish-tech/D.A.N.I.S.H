"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react";

type OnboardingStep = "welcome" | "name" | "timezone" | "voice" | "complete";

export function Onboarding({ onComplete, isOpen }: { onComplete: () => void; isOpen: boolean }) {
  const { getAccessToken } = useAuth();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [wakeWord, setWakeWord] = useState("Hello Danish");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authFetch = async (input: RequestInfo, init: RequestInit = {}) => {
    const headers = new Headers(init.headers ?? {});
    const authToken = getAccessToken();
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetch(input, { ...init, headers });
  };

    async function saveProfile() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          timezone: timezone.trim(),
        }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Failed to save profile");
      localStorage.setItem("danish_wake_word", wakeWord.trim());
    } catch {
      setError("Unable to save profile. Please try again.");
      setLoading(false);
      return;
    }
    setLoading(false);
    setStep("complete");
  }

  function nextStep() {
    if (step === "welcome") setStep("name");
    else if (step === "name") setStep("timezone");
    else if (step === "timezone") setStep("voice");
    else if (step === "voice") saveProfile();
  }

  function prevStep() {
    if (step === "name") setStep("welcome");
    else if (step === "timezone") setStep("name");
    else if (step === "voice") setStep("timezone");
  }

  const steps: { key: OnboardingStep; label: string }[] = [
    { key: "welcome", label: "Welcome" },
    { key: "name", label: "Your Name" },
    { key: "timezone", label: "Timezone" },
    { key: "voice", label: "Voice" },
    { key: "complete", label: "Done" },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass rounded-xl overflow-hidden"
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Setup D.A.N.I.S.H</h3>
            <div className="flex gap-1">
              {steps.map((s) => (
                <div
                  key={s.key}
                  className={`w-8 h-1 rounded transition ${step === s.key || (steps.indexOf(s) < steps.findIndex(x => x.key === step) && step !== "complete") ? "bg-cyan-electric" : "bg-white/10"}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {step === "welcome" && (
            <div className="text-center space-y-4">
              <div className="mx-auto grid size-16 place-items-center rounded-full border border-cyan-electric/30 bg-cyan-electric/10">
                <span className="text-2xl font-bold text-cyan-soft">D</span>
              </div>
              <h4 className="text-xl font-semibold text-white">Welcome to D.A.N.I.S.H</h4>
              <p className="text-sm text-muted-foreground">
                Let&apos;s personalize your AI operating system. This will only take a minute.
              </p>
            </div>
          )}

          {step === "name" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-semibold text-white">What should we call you?</h4>
                <p className="text-sm text-muted-foreground">This name will be used for greetings and voice activation.</p>
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-cyan-electric"
                autoFocus
                maxLength={50}
              />
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          )}

          {step === "timezone" && (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white">Select your timezone</h4>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-cyan-electric"
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">Eastern Time (US & Canada)</option>
                <option value="America/Chicago">Central Time (US & Canada)</option>
                <option value="America/Denver">Mountain Time (US & Canada)</option>
                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Europe/Paris">Paris (CET/CEST)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
                <option value="Asia/Kolkata">Kolkata (IST)</option>
                <option value="Australia/Sydney">Sydney (AEST/AEDT)</option>
              </select>
            </div>
          )}

          {step === "voice" && (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white">Voice wake word</h4>
              <p className="text-sm text-muted-foreground">
                Say this phrase to activate hands-free voice mode. Default is &quot;Hello Danish&quot;.
              </p>
              <input
                type="text"
                value={wakeWord}
                onChange={(e) => setWakeWord(e.target.value)}
                placeholder="Wake word phrase"
                className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-cyan-electric"
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                Example: &quot;Hey DANI&quot;, &quot;Hello Assistant&quot;, &quot;Hi Computer&quot;
              </p>
            </div>
          )}

          {step === "complete" && (
            <div className="text-center space-y-4">
              <CheckCircle className="mx-auto size-12 text-mint" />
              <h4 className="text-xl font-semibold text-white">You&apos;re all set!</h4>
              <p className="text-sm text-muted-foreground">
                Welcome to your personalized D.A.N.I.S.H experience.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {step !== "welcome" && step !== "complete" && (
              <Button variant="ghost" onClick={prevStep} disabled={loading}>
                Back
              </Button>
            )}
            <div className="flex-1" />
            {step === "complete" ? (
              <Button onClick={onComplete} disabled={loading} className="min-w-[140px]">
                <CheckCircle className="size-4 mr-2" />
                Get Started
              </Button>
            ) : (
              <Button onClick={nextStep} disabled={loading || (step === "name" && !displayName.trim())} className="min-w-[140px]">
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : step === "voice" ? (
                  <>
                    <CheckCircle className="size-4 mr-2" />
                    Complete Setup
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="size-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}