"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth-provider";
import {
  Activity,
  Bell,
  Bluetooth,
  Bot,
  CalendarDays,
  ChevronRight,
  CirclePower,
  CloudMoon,
  Command,
  Database,
  FileStack,
  FolderOpen,
  Gauge,
  Home,
  Laptop,
  LayoutDashboard,
  Menu,
  Mic,
  Monitor,
  PanelLeft,
  Play,
  Power,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Volume2,
  Wifi,
  Workflow,
  Zap
} from "lucide-react";
import { automations, commandExamples, devices, knowledgeBlocks, modules, quickActions, recentActions, systemMetrics } from "@/data/dashboard";
import { formatPercent, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSettings } from "@/components/profile-settings";
import { Onboarding } from "@/components/onboarding";

const menu = [
  { label: "Dashboard", icon: LayoutDashboard, href: "#dashboard" },
  { label: "Assistant", icon: Bot, href: "#assistant" },
  { label: "Remote Control", icon: Laptop, href: "#remote" },
  { label: "Automation", icon: Workflow, href: "#automation" },
  { label: "Files & Data", icon: FolderOpen, href: "#quick-access" },
  { label: "AI Tools", icon: Sparkles, href: "#content" },
  { label: "Calendar", icon: CalendarDays, href: "#reminders" },
  { label: "System Monitor", icon: Gauge, href: "#system" },
  { label: "Settings", icon: Settings, href: "#profile" }
];

const toneClass = {
  cyan: "text-cyan-electric border-cyan-electric/40 bg-cyan-electric/10",
  mint: "text-mint border-mint/40 bg-mint/10",
  amber: "text-amber border-amber/40 bg-amber/10",
  danger: "text-danger border-danger/40 bg-danger/10"
};

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
};

type SpeechRecognitionEventLike = Event & {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type VoiceLanguage = "hindi" | "hinglish" | "english";

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function detectVoiceLanguage(text: string): VoiceLanguage {
  const normalized = text.toLowerCase();
  if (/[\u0900-\u097F]/.test(text)) return "hindi";

  const hinglishWords = normalized.match(/\b(kya|kaise|kaisa|kaisi|kyu|kyun|nahi|nahin|haan|han|hai|hain|ho|hu|hun|mera|meri|mere|mujhe|tum|aap|apna|batao|bata|karna|karo|chahiye|acha|achha|theek|thik|yaar|bhai|kal|aaj|abhi|wala|wali|matlab)\b/g) ?? [];
  if (hinglishWords.length >= 2) return "hinglish";

  return "english";
}

function getSpeechVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

function findVoiceByLanguage(voices: SpeechSynthesisVoice[], language: string) {
  const wanted = language.toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase() === wanted)
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(wanted.split("-")[0]));
}

function describeSpeechError(event?: SpeechSynthesisErrorEvent) {
  if (!event) return null;
  return {
    error: event.error || "unknown",
    elapsedTime: event.elapsedTime,
    charIndex: event.charIndex,
    name: event.name,
    type: event.type
  };
}

function waitForSpeechVoices(timeoutMs = 2500) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve([]);

  const immediateVoices = getSpeechVoices();
  if (immediateVoices.length > 0) return Promise.resolve(immediateVoices);

  console.log("[VOICE] Speech voices not ready; waiting for voiceschanged");

  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let settled = false;
    const startedAt = Date.now();

    const finish = (reason: string) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);

      const voices = getSpeechVoices();
      console.log("[VOICE] Speech voice loading finished:", {
        reason,
        voiceCount: voices.length,
        waitedMs: Date.now() - startedAt
      });
      resolve(voices);
    };

    const onVoicesChanged = () => {
      if (getSpeechVoices().length > 0) finish("voiceschanged");
    };

    const pollId = window.setInterval(() => {
      if (getSpeechVoices().length > 0) finish("poll");
    }, 150);

    const timeoutId = window.setTimeout(() => finish("timeout"), timeoutMs);
    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
  });
}

function selectSpeechVoice(text: string, voices = getSpeechVoices()) {
  const detectedLanguage = detectVoiceLanguage(text);
  const requestedLang = detectedLanguage === "hindi" ? "hi-IN" : detectedLanguage === "hinglish" ? "en-IN" : "en-IN";
  const fallbackLangs = requestedLang === "hi-IN" ? ["en-IN", "en-US"] : ["hi-IN", "en-US"];
  const selectedVoice = findVoiceByLanguage(voices, requestedLang)
    ?? fallbackLangs.map((lang) => findVoiceByLanguage(voices, lang)).find(Boolean)
    ?? voices[0]
    ?? null;

  const selectedLang = selectedVoice?.lang || fallbackLangs[0] || requestedLang;
  console.log("[VOICE] Detected input language:", detectedLanguage);
  console.log("[VOICE] Speech synthesis support:", {
    "hi-IN": Boolean(findVoiceByLanguage(voices, "hi-IN")),
    "en-IN": Boolean(findVoiceByLanguage(voices, "en-IN")),
    "en-US": Boolean(findVoiceByLanguage(voices, "en-US")),
    voiceCount: voices.length
  });
  console.log("[VOICE] TTS selected voice:", selectedVoice ? {
    name: selectedVoice.name,
    lang: selectedVoice.lang,
    requestedLang,
    fallbackUsed: selectedVoice.lang.toLowerCase() !== requestedLang.toLowerCase()
  } : {
    name: null,
    lang: selectedLang,
    requestedLang,
    fallbackUsed: selectedLang.toLowerCase() !== requestedLang.toLowerCase()
  });

  return { selectedVoice, selectedLang };
}

// client no longer sends a default user id; server derives user from Authorization header

type UserProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export function CommandCenter() {
  const { getAccessToken, user } = useAuth();
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const authFetch = useCallback(async (input: RequestInfo, init: RequestInit = {}) => {
    const headers = new Headers(init.headers ?? {});
    const authToken = getAccessToken();

    if (authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }

    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(input, { ...init, headers });
  }, [getAccessToken]);

  useEffect(() => {
    async function loadProfile() {
      if (!user?.email) {
        setProfileLoading(false);
        return;
      }
      try {
        const res = await authFetch("/api/profile");
        const json = await res.json();
        if (json?.ok && json.data) {
          setProfile(json.data);
          if (!json.data.display_name) {
            setShowOnboarding(true);
          }
        }
      } catch (e) {
        console.error("Failed to load profile:", e);
      } finally {
        setProfileLoading(false);
      }
    }
    loadProfile();
  }, [authFetch, user?.email]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const submitAssistant = useCallback(async (message: string, mode: string = "assistant") => {
    if (!message) return null;
    try {
      // Optimistically add user message
      setMessages((prev) => [...prev, { role: "user", text: message }]);
      
      const res = await authFetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mode })
      });
      const json = await res.json();
      if (json?.ok && json.data) {
        const content = json.data.content || "I processed that, but I could not produce a full response.";
        setMessages((prev) => [...prev, { role: "assistant", text: content }]);
        return content;
      } else {
        const errorMessage = "Error: " + (json?.error || "Unable to reach assistant.");
        setMessages((prev) => [...prev, { role: "assistant", text: errorMessage }]);
        return errorMessage;
      }
    } catch (e) {
      console.error(e);
      const errorMessage = "System error: connection failed.";
      setMessages((prev) => [...prev, { role: "assistant", text: errorMessage }]);
      return errorMessage;
    }
  }, [authFetch]);

  return (
    <main id="dashboard" className="mx-auto min-h-screen w-full max-w-[1720px] p-3 sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_380px]">
        <Sidebar authFetch={authFetch} />
        <section className="space-y-4">
          <HeroCommand profile={profile} onCommand={submitAssistant} />
          <MobileSectionNav />
          <ModuleGrid />
          <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
            <RemoteControl authFetch={authFetch} />
            <AutomationPanel authFetch={authFetch} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
            <div className="space-y-4">
              <AssistantPanel authFetch={authFetch} messages={messages} onSendMessage={submitAssistant} />
              <MemoryPanel authFetch={authFetch} />
              <RemindersPanel authFetch={authFetch} />
            </div>
            <StudyAndCareer />
          </div>
        </section>
        <section className="space-y-4">
          <ProfileSummary profile={profile} />
          <ProfileSettings />
          <MobileVoice onSendMessage={submitAssistant} />
          <SystemPanel authFetch={authFetch} />
          <CommandExamples onSendMessage={submitAssistant} />
          <Notifications />
          <QuickAccess />
        </section>
      </div>
      <BottomDock />
    </main>
  );
}

function Sidebar({ authFetch }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  async function handleQuickAction(label: string) {
    try {
      const action = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      await authFetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: "00000000-0000-4000-a000-000000000000", action }) // Using a generic UUID placeholder for mock
      });
      console.log("Quick action sent:", label);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <aside className="glass sticky top-5 hidden h-[calc(100vh-40px)] rounded-lg p-4 xl:block">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-md border border-cyan-electric/40 bg-cyan-electric/10 shadow-glow">
          <Command className="size-6 text-cyan-electric" />
        </div>
        <div>
          <p className="text-xl font-semibold tracking-[0.16em] text-white">D.A.N.I.S.H</p>
          <p className="text-xs text-muted-foreground">v1.0.0</p>
        </div>
      </div>
      <p className="mb-3 text-xs font-semibold uppercase text-cyan-soft">Main Menu</p>
      <nav className="space-y-1">
        {menu.map((item, index) => (
          <a
            key={item.label}
            href={item.href}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-white/[0.06] hover:text-white",
              index === 0 && "bg-cyan-electric/12 text-white"
            )}
          >
            <item.icon className="size-4 text-cyan-soft" />
            {item.label}
          </a>
        ))}
      </nav>
      <p className="mb-3 mt-8 text-xs font-semibold uppercase text-cyan-soft">Quick Actions</p>
      <div className="space-y-2">
        {quickActions.map((item) => (
          <Button key={item.label} variant="secondary" size="sm" className="w-full justify-start" onClick={() => handleQuickAction(item.label)}>
            <item.icon className="size-4" />
            {item.label}
          </Button>
        ))}
      </div>
    </aside>
  );
}

function MobileSectionNav() {
  return (
    <nav className="glass grid grid-cols-3 gap-2 rounded-lg p-3 sm:grid-cols-5 xl:hidden">
      {menu.slice(0, 10).map((item) => (
        <a
          key={item.label}
          href={item.href}
          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border border-cyan-electric/10 bg-black/18 px-2 py-2 text-center text-[11px] text-muted-foreground transition hover:border-cyan-electric/30 hover:text-white"
        >
          <item.icon className="size-4 text-cyan-soft" />
          <span className="leading-tight">{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

function ProfileSummary({ profile }: { profile?: UserProfile | null }) {
  const profileName = profile?.display_name || "Authenticated user";
  const initials = profile?.display_name ? profile.display_name.slice(0, 2).toUpperCase() : "AU";

  return (
    <Card id="profile">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <span className="text-xs text-mint">Signed in</span>
      </CardHeader>
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-md border border-cyan-electric/30 bg-cyan-electric/10 text-sm font-semibold text-cyan-soft">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{profileName}</p>
          <p className="truncate text-xs text-muted-foreground">{profile?.timezone || "UTC"}</p>
        </div>
      </div>
      {profile?.bio ? (
        <p className="mt-3 text-sm text-muted-foreground">{profile.bio}</p>
      ) : null}
    </Card>
  );
}

function HeroCommand({ profile, onCommand }: { profile?: UserProfile | null; onCommand: (msg: string) => Promise<string | null> }) {
  const [input, setInput] = useState("");
  const greetingName = profile?.display_name || "User";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onCommand(input.trim());
      setInput("");
    }
  };

  return (
    <Card className="relative min-h-[560px] overflow-hidden p-4 sm:p-6">
      <div className="absolute inset-0 opacity-70">
        <div className="absolute left-1/2 top-[47%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-electric/10" />
        <div className="absolute left-[18%] top-[30%] h-px w-52 rotate-45 bg-cyan-electric/20" />
        <div className="absolute right-[12%] top-[35%] h-px w-64 -rotate-45 bg-mint/15" />
      </div>
      <header className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSubmit} className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-lg border border-cyan-electric/14 bg-black/30 px-4 focus-within:border-cyan-electric/40">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-muted-foreground"
            placeholder="Type a command or ask anything..."
          />
          <button type="submit" className="hidden" />
          <Mic className="ml-auto size-4 shrink-0 text-cyan-soft cursor-pointer hover:text-cyan-electric" />
        </form>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="hidden items-center gap-2 rounded-md border border-cyan-electric/14 bg-black/20 px-3 py-2 sm:flex">
            <Activity className="size-4 text-cyan-electric" />
            Friday, 31 May 2024
          </div>
          <Button variant="ghost" size="icon" className="xl:hidden">
            <Menu className="size-5" />
          </Button>
        </div>
      </header>
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center pt-12 text-center sm:pt-16">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-semibold tracking-[0.18em] text-white drop-shadow-[0_0_20px_rgba(53,217,255,0.65)] sm:text-7xl"
        >
          D.A.N.I.S.H
        </motion.h1>
        <p className="mt-3 text-sm font-medium text-cyan-soft sm:text-base">
          Dynamic AI Network for Intelligence, Systems & Help
        </p>
        <p className="mt-8 text-2xl font-medium text-white">
          Good Evening, <span className="text-cyan-soft">{greetingName}.</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">All Systems Operational.</p>
        <VoiceCore />
        <VoiceAssistant onSendMessage={onCommand} />
        <p className="mt-8 text-xl text-white">What would you like me to do today?</p>
        <VoiceWave className="mt-5 w-full max-w-xl" />
      </div>
    </Card>
  );
}

function VoiceCore() {
  return (
    <div className="relative mt-8 grid size-56 place-items-center">
      {[0, 1, 2].map((ring) => (
        <div
          key={ring}
          className="absolute rounded-full border border-cyan-electric/30 animate-pulse-ring"
          style={{
            inset: `${ring * 28}px`,
            animationDelay: `${ring * 0.34}s`
          }}
        />
      ))}
      <div className="absolute inset-8 rounded-full border border-cyan-electric/18" />
      <div className="absolute inset-14 rounded-full border border-mint/20" />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 14, ease: "linear" }}
        className="absolute inset-3 rounded-full border-t border-cyan-electric/80"
      />
      <div className="grid size-24 place-items-center rounded-full border border-cyan-electric/40 bg-cyan-electric/12 shadow-glow">
        <Mic className="size-10 text-cyan-soft" />
      </div>
    </div>
  );
}

function VoiceAssistant({ onSendMessage }: { onSendMessage: (msg: string) => Promise<string | null> }) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const activatedRef = useRef(false);
  const speakingRef = useRef(false);
  const recognitionPausedRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [activated, setActivated] = useState(false);
  const [status, setStatus] = useState("Wake word off");
  const [lastTranscript, setLastTranscript] = useState("");

  const pauseRecognition = useCallback((reason: string) => {
    recognitionPausedRef.current = true;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
      console.log("[VOICE] Recognition paused:", { reason, wasListening: listeningRef.current });
    } catch (error) {
      console.warn("[VOICE] Recognition pause failed:", {
        reason,
        error: error instanceof Error ? { name: error.name, message: error.message } : error
      });
    } finally {
      listeningRef.current = false;
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) {
      console.warn("[VOICE] Speech synthesis is not supported in this browser");
      return Promise.resolve();
    }

    const speechText = text.trim();
    if (!speechText) return Promise.resolve();

    const speakOnce = async () => {
      const voices = await waitForSpeechVoices();
      const { selectedVoice, selectedLang } = selectSpeechVoice(speechText, voices);
      pauseRecognition("tts-start");

      return new Promise<void>((resolve) => {
        console.log("[VOICE] TTS preparing:", {
          textLength: speechText.length,
          selectedLang,
          selectedVoice: selectedVoice ? `${selectedVoice.name} (${selectedVoice.lang})` : null,
          pending: window.speechSynthesis.pending,
          speaking: window.speechSynthesis.speaking,
          paused: window.speechSynthesis.paused
        });

        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          console.log("[VOICE] TTS clearing existing browser queue before speaking");
          window.speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.lang = selectedLang;
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.rate = 0.96;
        utterance.pitch = 1;
        utterance.volume = 1;
        speakingRef.current = true;

        let settled = false;
        const timeoutMs = Math.min(Math.max(speechText.length * 90, 5000), 30000);
        const finish = (eventName: string, event?: SpeechSynthesisEvent | SpeechSynthesisErrorEvent) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          speakingRef.current = false;
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
          console.log(`[VOICE] TTS ${eventName}:`, {
            lang: utterance.lang,
            voice: utterance.voice ? `${utterance.voice.name} (${utterance.voice.lang})` : null,
            elapsedTime: event?.elapsedTime ?? null,
            charIndex: event?.charIndex ?? null,
            browserState: {
              pending: window.speechSynthesis.pending,
              speaking: window.speechSynthesis.speaking,
              paused: window.speechSynthesis.paused
            }
          });
          resolve();
        };

      const timeoutId = window.setTimeout(() => {
  console.warn("[VOICE] TTS timeout reached:", {
    timeoutMs,
    textLength: speechText.length,
    lang: utterance.lang
  });

  finish("timeout");
}, 60000); // 60 seconds

        utterance.onstart = (event) => {
          console.log("[VOICE] TTS start:", {
            lang: utterance.lang,
            voice: utterance.voice ? `${utterance.voice.name} (${utterance.voice.lang})` : null,
            elapsedTime: event.elapsedTime,
            charIndex: event.charIndex
          });
        };
        utterance.onend = (event) => {
          finish("end", event);
        };
        utterance.onerror = (event) => {
          console.error("[VOICE] TTS error:", {
            event: describeSpeechError(event),
            lang: utterance.lang,
            voice: utterance.voice ? `${utterance.voice.name} (${utterance.voice.lang})` : null,
            textLength: speechText.length,
            browserState: {
              pending: window.speechSynthesis.pending,
              speaking: window.speechSynthesis.speaking,
              paused: window.speechSynthesis.paused
            }
          });
          finish("error", event);
        };
        window.speechSynthesis.speak(utterance);
      });
    };

    const queuedSpeech = speechQueueRef.current.catch(() => undefined).then(speakOnce);
    speechQueueRef.current = queuedSpeech;
    return queuedSpeech;
  }, [pauseRecognition]);

  const restartListening = useCallback(() => {
    if (!enabled || listeningRef.current || speakingRef.current || recognitionPausedRef.current) return;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      try {
        recognitionRef.current?.start();
        listeningRef.current = true;
        setStatus(activatedRef.current ? "Listening for your command..." : "Listening for \"Hello Danish\"...");
      } catch (error) {
        console.warn("[VOICE] Recognition start failed:", {
          error: error instanceof Error ? { name: error.name, message: error.message } : error,
          enabled,
          pausedForSpeech: recognitionPausedRef.current,
          speaking: speakingRef.current
        });
        listeningRef.current = false;
      }
    }, 250);
  }, [enabled]);

  const processCommand = useCallback(async (command: string) => {
    const cleaned = command.trim();
    if (!cleaned) return;
    console.log("[VOICE] Detected input language:", detectVoiceLanguage(cleaned));

    pauseRecognition("processing-command");
    setStatus("Thinking...");
    const response = await onSendMessage(cleaned);
    if (response) {
      setStatus("Speaking...");
      await speak(response);
    }
    recognitionPausedRef.current = false;
    setStatus("Listening for your command...");
    restartListening();
  }, [onSendMessage, pauseRecognition, restartListening, speak]);

  const handleTranscript = useCallback(async (transcript: string) => {
    const cleaned = transcript.trim();
    const normalized = cleaned.toLowerCase();
    setLastTranscript(cleaned);

    if (!activatedRef.current) {
      if (!normalized.includes("hello danish") || Date.now() < cooldownUntilRef.current) return;

      cooldownUntilRef.current = Date.now() + 3500;
      activatedRef.current = true;
      setActivated(true);
      setStatus("Activated");
      pauseRecognition("wake-word");
      await speak("Hello Danish, how can I help you today?");

      const commandAfterWake = cleaned.replace(/hello danish/i, "").trim();
      if (commandAfterWake) {
        await processCommand(commandAfterWake);
      } else {
        recognitionPausedRef.current = false;
        setStatus("Listening for your command...");
        restartListening();
      }
      return;
    }

    pauseRecognition("command-captured");
    await processCommand(cleaned);
  }, [pauseRecognition, processCommand, restartListening, speak]);

  useEffect(() => {
    if (!enabled) return;

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      setStatus("Voice recognition is not supported in this browser");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    recognition.onresult = (event) => {
      if (recognitionPausedRef.current || speakingRef.current) {
        console.log("[VOICE] Recognition result ignored while paused/speaking:", {
          pausedForSpeech: recognitionPausedRef.current,
          speaking: speakingRef.current
        });
        return;
      }

      let finalText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
      }
      if (finalText) void handleTranscript(finalText);
    };
    recognition.onerror = (event) => {
      const recognitionError = event as Event & { error?: string; message?: string };
      console.warn("[VOICE] Recognition error:", {
        error: recognitionError.error ?? "unknown",
        message: recognitionError.message ?? null,
        pausedForSpeech: recognitionPausedRef.current,
        speaking: speakingRef.current
      });
      listeningRef.current = false;
      if (!recognitionPausedRef.current && !speakingRef.current) setStatus("Mic paused. Restarting...");
    };
    recognition.onend = () => {
      console.log("[VOICE] Recognition ended:", {
        enabled,
        pausedForSpeech: recognitionPausedRef.current,
        speaking: speakingRef.current
      });
      listeningRef.current = false;
      restartListening();
    };

    recognitionRef.current = recognition;
    restartListening();

    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.stop();
      recognitionRef.current = null;
      listeningRef.current = false;
    };
  }, [enabled, handleTranscript, restartListening]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const logVoiceSupport = () => {
      const voices = getSpeechVoices();
      console.log("[VOICE] Available speech synthesis voices:", voices.map((voice) => ({ name: voice.name, lang: voice.lang })));
      console.log("[VOICE] Speech synthesis support:", {
        "hi-IN": Boolean(findVoiceByLanguage(voices, "hi-IN")),
        "en-IN": Boolean(findVoiceByLanguage(voices, "en-IN")),
        "en-US": Boolean(findVoiceByLanguage(voices, "en-US"))
      });
    };

    logVoiceSupport();
    window.speechSynthesis.onvoiceschanged = logVoiceSupport;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const toggleListening = async () => {
    if (enabled) {
      setEnabled(false);
      setActivated(false);
      activatedRef.current = false;
      recognitionPausedRef.current = false;
      speakingRef.current = false;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      setStatus("Wake word off");
      console.log("[VOICE] Voice mode stopped; cancelling recognition and speech");
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
      return;
    }

    setSupported(true);
    setEnabled(true);
    setStatus("Listening for \"Hello Danish\"...");
  };

  return (
    <div className="mt-5 w-full max-w-xl rounded-lg border border-cyan-electric/14 bg-black/28 p-3 text-left">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant={enabled ? "secondary" : "primary"} onClick={toggleListening}>
          <Mic className="size-4" />
          {enabled ? "Stop Voice" : "Start Voice"}
        </Button>
        <span className={cn("text-xs", activated ? "text-mint" : enabled ? "text-cyan-soft" : "text-muted-foreground")}>{status}</span>
      </div>
      <p className="mt-2 min-h-5 truncate text-xs text-muted-foreground">
        {supported ? lastTranscript || "Say \"Hello Danish\" to activate hands-free mode." : "Use Chrome or Edge for speech recognition."}
      </p>
    </div>
  );
}

function VoiceWave({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-10 items-center justify-center gap-1", className)}>
      {Array.from({ length: 46 }).map((_, index) => (
        <span
          key={index}
          className="block w-1 rounded-full bg-cyan-electric/80 animate-wave"
          style={{
            height: `${8 + ((index * 13) % 28)}px`,
            animationDelay: `${index * 0.035}s`
          }}
        />
      ))}
    </div>
  );
}

function ModuleGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map((module) => (
        <Card key={module.title} className="group min-h-40 transition hover:border-cyan-electric/32 hover:bg-white/[0.045]">
          <div className="mb-5 flex items-center justify-between">
            <div className="grid size-10 place-items-center rounded-md border border-cyan-electric/25 bg-cyan-electric/10">
              <module.icon className="size-5 text-cyan-soft" />
            </div>
            <span className="rounded-full border border-mint/20 bg-mint/10 px-2 py-1 text-xs text-mint">{module.status}</span>
          </div>
          <h2 className="font-semibold text-white">{module.title}</h2>
          <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{module.description}</p>
          <a href={module.href} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-soft">
            {module.action}
            <ChevronRight className="size-4 transition group-hover:translate-x-1" />
          </a>
        </Card>
      ))}
    </div>
  );
}

function RemoteControl({ authFetch }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function queueDeviceAction(action: string) {
    setPendingAction(action);
    setActionStatus(null);
    setActionError(null);

    try {
      const res = await authFetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: "00000000-0000-4000-a000-000000000000", action })
      });
      const json = await res.json();
      if (json?.ok) {
        setActionStatus(`${action.replace(/_/g, " ")} queued.`);
      } else {
        setActionError(json?.error || "Unable to queue device command.");
      }
    } catch {
      setActionError("Unable to reach device command API.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <Card id="remote" className="min-h-[410px]">
      <CardHeader>
        <CardTitle>Remote Control</CardTitle>
        <span className="text-xs text-muted-foreground">{pendingAction ? "Queueing command" : "Connected to laptop"}</span>
      </CardHeader>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-md bg-mint/10 text-mint">
          <Laptop className="size-5" />
        </div>
        <div>
          <p className="font-medium text-white">Danish&apos;s Laptop</p>
          <p className="text-xs text-muted-foreground">Windows 11 Pro</p>
        </div>
      </div>
      <div className="rounded-lg border border-cyan-electric/14 bg-black/35 p-3">
        <div className="relative aspect-video overflow-hidden rounded-md border border-cyan-electric/14 bg-[#06111d]">
          <div className="absolute inset-x-0 bottom-0 h-10 bg-black/28" />
          <div className="absolute left-[18%] top-[15%] h-[70%] w-[54%] rounded-[38%] bg-[radial-gradient(circle_at_30%_30%,#35d9ff,transparent_45%),radial-gradient(circle_at_70%_55%,#2248ff,transparent_48%)] blur-sm" />
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
            {Array.from({ length: 9 }).map((_, index) => (
              <span key={index} className="size-2 rounded-full bg-white/50" />
            ))}
          </div>
          <div className="absolute left-3 top-3 space-y-2">
            {[Power, PanelLeft, Monitor, Volume2, ShieldCheck].map((Icon) => (
              <div key={Icon.displayName} className="grid size-8 place-items-center rounded-md border border-white/10 bg-black/40">
                <Icon className="size-4 text-cyan-soft" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <Button
          variant="danger"
          className="flex-1"
          disabled={Boolean(pendingAction)}
          onClick={() => queueDeviceAction("disconnect")}
        >
          <CirclePower className="size-4" />
          {pendingAction === "disconnect" ? "Queueing..." : "Disconnect"}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={Boolean(pendingAction)}
          onClick={() => queueDeviceAction("fullscreen")}
        >
          <Monitor className="size-4" />
          {pendingAction === "fullscreen" ? "Queueing..." : "Full Screen"}
        </Button>
      </div>
      {actionStatus ? <p className="mt-3 text-xs text-mint">{actionStatus}</p> : null}
      {actionError ? <p className="mt-3 text-xs text-danger">{actionError}</p> : null}
    </Card>
  );
}

function AutomationPanel({ authFetch }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  type AutomationItem = {
    id: string;
    title: string;
    description?: string | null;
    enabled?: boolean;
    trigger?: unknown;
  };

  const [localAutomations, setLocalAutomations] = useState<AutomationItem[]>(automations);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAutomations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/automations");
      const json = await res.json();
      if (json?.ok) {
        setLocalAutomations(json.data || []);
      } else {
        setError(json?.error || "Failed to load workflows.");
      }
    } catch {
      setError("Unable to load workflows.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadAutomations();
  }, [loadAutomations]);

  async function createAutomation() {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Workflow", description: "Draft workflow ready to configure", trigger: {}, steps: [] })
      });
      const json = await res.json();
      if (json?.ok && json.data) {
        setLocalAutomations((prev) => [json.data, ...prev]);
      } else {
        setError(json?.error || "Failed to create workflow.");
      }
    } catch {
      setError("Unable to create workflow.");
    } finally {
      setSaving(false);
    }
  }

  function formatTrigger(trigger: unknown) {
    if (typeof trigger === "string") return trigger;
    if (trigger && typeof trigger === "object" && Object.keys(trigger).length > 0) return JSON.stringify(trigger);
    return "Trigger not configured";
  }

  return (
    <Card id="automation" className="min-h-[410px]">
      <CardHeader>
        <CardTitle>Automation Workflows</CardTitle>
        <Button variant="ghost" size="sm" disabled={saving} onClick={createAutomation}>
          {saving ? "Saving" : "New"}
        </Button>
      </CardHeader>
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">Loading workflows...</div>
        ) : localAutomations.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">No workflows yet.</div>
        ) : (
          localAutomations.map((automation) => (
            <div key={automation.id} className="flex items-center gap-3 rounded-lg border border-cyan-electric/12 bg-black/24 p-3">
              <div className={cn("grid size-10 place-items-center rounded-md border", automation.enabled !== false ? toneClass.mint : toneClass.danger)}>
                <Workflow className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{automation.title}</p>
                <p className="truncate text-xs text-muted-foreground">{automation.description || "No description added yet."}</p>
                <p className="mt-1 truncate text-xs text-cyan-soft">{formatTrigger(automation.trigger)}</p>
              </div>
              <span className={cn("h-6 w-11 rounded-full p-1 transition", automation.enabled !== false ? "bg-mint/70" : "bg-danger/45")}>
                <span className={cn("block size-4 rounded-full bg-white transition", automation.enabled !== false && "translate-x-5")} />
              </span>
            </div>
          ))
        )}
      </div>
      {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
      <Button variant="secondary" className="mt-5 w-full" disabled={saving} onClick={createAutomation}>
        <Workflow className="size-4" />
        {saving ? "Creating Workflow..." : "Create New Workflow"}
      </Button>
    </Card>
  );
}

function AssistantPanel({ messages, onSendMessage }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>; messages: Array<{role: string; text: string}>; onSendMessage: (msg: string) => Promise<string | null> }) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  return (
    <Card id="assistant" className="min-h-[360px]">
      <CardHeader>
        <CardTitle>AI Assistant</CardTitle>
        <span className="text-xs text-mint">Context aware</span>
      </CardHeader>
      <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No messages yet. Ask D.A.N.I.S.H anything.</p>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className={`${m.role === "assistant" ? "ml-auto max-w-[82%] rounded-lg border border-cyan-electric/18 bg-cyan-electric/10 p-3 text-sm text-white" : "max-w-[90%] rounded-lg border border-mint/18 bg-black/24 p-3 text-sm leading-6 text-muted-foreground"}`}>
              {m.text}
            </div>
          ))
        )}
      </div>
      <div className="mt-5 flex items-center gap-2 rounded-lg border border-cyan-electric/14 bg-black/30 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Ask anything..."
        />
        <Button size="icon" onClick={handleSend}>
          <Play className="size-4 fill-current" />
        </Button>
      </div>
    </Card>
  );
}

function MemoryPanel({ authFetch }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  const categories = ["personal", "study", "relationship", "goal", "conversation"] as const;
  type Memory = { id: string; category: string; title: string; body: string; tags: string[]; importance?: number; created_at: string };
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<typeof categories[number]>("personal");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState<typeof categories[number]>("personal");
  const [newImportance, setNewImportance] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMemories = useCallback(async (category: string) => {
    setLoading(true);
    setError(null);
    try {
        const res = await authFetch(`/api/memories?category=${encodeURIComponent(category)}`);
      const json = await res.json();
      if (json?.ok) {
        setMemories(json.data || []);
      } else {
        setError(json?.error || "Failed to load memories.");
      }
    } catch {
      setError("Unable to load memories.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadMemories(selectedCategory);
  }, [loadMemories, selectedCategory]);

  async function createMemory() {
    if (!newTitle || !newBody) {
      setError("Memory title and body are required.");
      return;
    }
    setError(null);
    try {
      const res = await authFetch("/api/memories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: newTitle, body: newBody, category: newCategory, importance: newImportance, tags: [] })
      });
      const json = await res.json();
      if (json?.ok) {
        setNewTitle("");
        setNewBody("");
        setNewImportance(5);
        loadMemories(selectedCategory);
      } else {
        setError(json?.error || "Failed to save memory.");
      }
    } catch {
      setError("Unable to save memory.");
    }
  }

  return (
    <Card id="memories" className="min-h-[360px]">
      <CardHeader>
        <CardTitle>Memory Manager</CardTitle>
        <span className="text-xs text-muted-foreground">Personal, Study, Relationship, Goals</span>
      </CardHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                selectedCategory === category
                  ? "border-cyan-electric bg-cyan-electric/10 text-white"
                  : "border-white/10 text-muted-foreground hover:border-cyan-electric"
              )}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="space-y-2 rounded-lg border border-cyan-electric/14 bg-black/20 p-3">
          <p className="text-sm font-medium text-white">Create new memory</p>
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Memory title" className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none" />
          <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Memory body" className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none" rows={3} />
          <div className="flex flex-wrap items-center gap-2">
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as typeof categories[number])} className="rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none">
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Importance:</span>
                <input type="number" min="1" max="10" value={newImportance} onChange={(e) => setNewImportance(parseInt(e.target.value))} className="w-16 rounded-md border border-white/10 bg-transparent px-2 py-1 text-sm text-white outline-none" />
            </div>
            <Button variant="secondary" onClick={createMemory}>
              Save Memory
            </Button>
          </div>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing recent {selectedCategory} memories</span>
            {loading ? <span>Loading...</span> : null}
          </div>
          {memories.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">No memories saved yet.</div>
          ) : (
            memories.map((memory) => (
              <div key={memory.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{memory.title}</p>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-amber">Rank {memory.importance || 5}</span>
                  </div>
                  <span className="rounded-full border border-cyan-electric/20 bg-cyan-electric/5 px-2 py-1 text-[10px] uppercase text-cyan-soft">{memory.category}</span>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{memory.body}</p>
                <p className="mt-2 text-[11px] text-white/70">{new Date(memory.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

function RemindersPanel({ authFetch }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  type Reminder = {
    id: string;
    title: string;
    body?: string | null;
    remind_at?: string | null;
    recurring?: string | null;
    shared?: boolean;
    created_at: string;
  };

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [recurring, setRecurring] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/reminders");
      const json = await res.json();
      if (json?.ok) {
        setReminders(json.data || []);
      } else {
        setError(json?.error || "Failed to load reminders.");
      }
    } catch {
      setError("Unable to load reminders.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  async function createReminder() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Reminder title is required.");
      setSuccess(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        title: cleanTitle,
        body: body.trim() || undefined,
        remind_at: remindAt ? new Date(remindAt).toISOString() : undefined,
        recurring: recurring.trim() || undefined
      };
      const res = await authFetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json?.ok) {
        setTitle("");
        setBody("");
        setRemindAt("");
        setRecurring("");
        setSuccess("Reminder saved.");
        await loadReminders();
      } else {
        setError(json?.error || "Failed to save reminder.");
      }
    } catch {
      setError("Unable to save reminder.");
    } finally {
      setSaving(false);
    }
  }

  const sortedReminders = [...reminders].sort((a, b) => {
    const aTime = a.remind_at ? new Date(a.remind_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.remind_at ? new Date(b.remind_at).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
  const upcomingCount = reminders.filter((reminder) => reminder.remind_at && new Date(reminder.remind_at).getTime() >= Date.now()).length;

  return (
    <Card id="reminders" className="min-h-[360px]">
      <CardHeader>
        <CardTitle>Reminders</CardTitle>
        <span className="text-xs text-cyan-soft">{loading ? "Syncing" : `${upcomingCount} upcoming`}</span>
      </CardHeader>
      <div className="space-y-4">
        <div className="space-y-2 rounded-lg border border-cyan-electric/14 bg-black/20 p-3">
          <p className="text-sm font-medium text-white">Create reminder</p>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Reminder title"
            className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none"
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Optional details"
            className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none"
            rows={2}
          />
          <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
            <input
              type="datetime-local"
              value={remindAt}
              onChange={(event) => setRemindAt(event.target.value)}
              className="min-w-0 rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none"
            />
            <input
              value={recurring}
              onChange={(event) => setRecurring(event.target.value)}
              placeholder="Repeat"
              className="min-w-0 rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={createReminder} disabled={saving}>
              <CalendarDays className="size-4" />
              {saving ? "Saving..." : "Save Reminder"}
            </Button>
            {success ? <span className="text-xs text-mint">{success}</span> : null}
          </div>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Upcoming and recent reminders</span>
            <button type="button" className="text-cyan-soft hover:text-cyan-electric" onClick={loadReminders}>
              Refresh
            </button>
          </div>
          {loading ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">Loading reminders...</div>
          ) : sortedReminders.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">No reminders yet.</div>
          ) : (
            sortedReminders.slice(0, 6).map((reminder) => (
              <div key={reminder.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md border border-amber/30 bg-amber/10 text-amber">
                    <Bell className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{reminder.title}</p>
                    {reminder.body ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{reminder.body}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/70">
                      <span>{reminder.remind_at ? new Date(reminder.remind_at).toLocaleString() : "No time set"}</span>
                      {reminder.recurring ? <span className="text-cyan-soft">{reminder.recurring}</span> : null}
                      {reminder.shared ? <span className="text-mint">Shared</span> : null}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

function StudyAndCareer() {
  const pills = ["PDF to Notes", "AI Teacher", "Exam Mode", "Resume Analyzer", "Interview Coach", "Research Mode"];
  return (
    <Card id="study" className="min-h-[360px] overflow-hidden">
      <CardHeader>
        <CardTitle>Study OS + Career OS</CardTitle>
        <span className="text-xs text-muted-foreground">Mentor layer active</span>
      </CardHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-cyan-electric/14 bg-black/24 p-4">
          <p className="text-sm font-semibold text-white">Today&apos;s Study Goal</p>
          <p className="mt-2 text-3xl font-semibold text-cyan-soft">72%</p>
          <p className="mt-2 text-sm text-muted-foreground">Organic Chemistry revision, 30 flashcards, one timed quiz.</p>
        </div>
        <div className="rounded-lg border border-mint/14 bg-black/24 p-4">
          <p id="career" className="text-sm font-semibold text-white">Career Pipeline</p>
          <p className="mt-2 text-3xl font-semibold text-mint">12</p>
          <p className="mt-2 text-sm text-muted-foreground">Saved internships with generated resumes and cover-letter drafts.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {pills.map((pill) => (
          <span key={pill} className="rounded-md border border-cyan-electric/14 bg-white/[0.04] px-3 py-2 text-xs text-muted-foreground">
            {pill}
          </span>
        ))}
      </div>
      <div id="content" className="mt-4 rounded-lg border border-cyan-electric/14 bg-black/24 p-4">
        <p className="text-sm font-semibold text-white">Content Factory Pipeline</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {["Analyze", "Clip", "Caption", "Publish"].map((step, index) => (
            <div key={step} className="rounded-md border border-cyan-electric/14 bg-cyan-electric/8 p-3 text-center text-xs text-cyan-soft">
              {index + 1}. {step}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function MobileVoice({ onSendMessage }: { onSendMessage: (msg: string) => Promise<string | null> }) {
  return (
    <Card className="overflow-hidden p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-sm text-white">9:41</span>
        <div className="flex gap-1">
          <Wifi className="size-4 text-white" />
          <Bluetooth className="size-4 text-white" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-2xl font-semibold tracking-[0.12em] text-white">D.A.N.I.S.H</p>
        <p className="text-sm text-muted-foreground">Your AI Assistant</p>
      </div>
      <div className="mx-auto mt-6 grid size-40 place-items-center rounded-full border border-cyan-electric/25 bg-cyan-electric/8 shadow-glow">
        <VoiceCoreMini />
      </div>
      <p className="mt-5 text-center text-lg text-white">Good Evening, <span className="text-cyan-soft">Danish.</span></p>
      <p className="text-center text-sm text-muted-foreground">What can I help you with?</p>
      <VoiceWave className="mx-auto mt-2 max-w-[260px]" />
      <Button
        className="mx-auto mt-4 flex"
        onClick={() => onSendMessage("Hello, D.A.N.I.S.H")}
      >
        Tap to Speak
        <Mic className="size-4" />
      </Button>
      <div className="mt-5 grid grid-cols-4 gap-2 text-center text-[11px] text-muted-foreground">
        {[
          ["Remote", Monitor],
          ["AI Chat", Bot],
          ["Auto", Workflow],
          ["Files", FileStack]
        ].map(([label, Icon]) => {
          const RealIcon = Icon as typeof Monitor;
          return (
            <div key={label as string} className="space-y-2">
              <div className="mx-auto grid size-10 place-items-center rounded-md border border-cyan-electric/14 bg-black/24">
                <RealIcon className="size-4 text-cyan-soft" />
              </div>
              <span>{label as string}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function VoiceCoreMini() {
  return (
    <div className="relative grid size-28 place-items-center">
      <div className="absolute inset-0 rounded-full border border-cyan-electric/20" />
      <div className="absolute inset-5 rounded-full border border-mint/20" />
      <div className="grid size-16 place-items-center rounded-full bg-cyan-electric/16">
        <Mic className="size-8 text-cyan-soft" />
      </div>
    </div>
  );
}

function SystemPanel({ authFetch }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  type DashboardDevice = {
    id: string;
    name: string;
    type?: string;
    device_type?: string;
    status?: string;
  };

  const [deviceList, setDeviceList] = useState<DashboardDevice[]>(devices);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/devices");
      const json = await res.json();
      if (json?.ok) {
        setDeviceList(json.data || []);
      } else {
        setError(json?.error || "Failed to load devices.");
      }
    } catch {
      setError("Unable to load devices.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  function getDeviceType(device: DashboardDevice) {
    return device.device_type || device.type || "desktop";
  }

  return (
    <Card id="system">
      <CardHeader>
        <CardTitle>System Overview</CardTitle>
        <span className="text-xs text-cyan-soft">{loading ? "Syncing" : `${deviceList.length} devices`}</span>
      </CardHeader>
      <div className="grid grid-cols-4 gap-2">
        {systemMetrics.map((metric) => (
          <div key={metric.label} className={cn("rounded-md border p-3 text-center", toneClass[metric.tone])}>
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{formatPercent(metric.value)}</p>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-cyan-soft">Connected Devices</p>
          <button type="button" className="text-xs text-cyan-soft hover:text-cyan-electric" onClick={loadDevices}>
            Refresh
          </button>
        </div>
        {error ? <p className="mb-2 text-xs text-danger">{error}</p> : null}
        {loading ? (
          <div className="rounded-md bg-black/22 p-3 text-sm text-muted-foreground">Loading devices...</div>
        ) : deviceList.length === 0 ? (
          <div className="rounded-md bg-black/22 p-3 text-sm text-muted-foreground">No devices registered yet.</div>
        ) : (
          <div className="space-y-2">
            {deviceList.map((device) => {
              const deviceType = getDeviceType(device);
              const status = device.status || "offline";
              return (
                <div key={device.id} className="flex items-center gap-3 rounded-md bg-black/22 p-2">
                  {deviceType === "phone" ? <Smartphone className="size-4 text-cyan-soft" /> : <Monitor className="size-4 text-cyan-soft" />}
                  <span className="min-w-0 flex-1 truncate text-sm text-white">{device.name}</span>
                  <span className={cn("text-xs", status === "offline" ? "text-danger" : status === "idle" ? "text-amber" : "text-mint")}>
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

function CommandExamples({ onSendMessage }: { onSendMessage: (msg: string) => Promise<string | null> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Command Examples</CardTitle>
      </CardHeader>
      <div className="space-y-2">
        {commandExamples.map((command) => (
          <div
            key={command}
            className="flex items-center gap-3 rounded-md border border-cyan-electric/10 bg-black/24 p-3 cursor-pointer hover:bg-white/[0.05]"
            onClick={() => onSendMessage(command)}
          >
            <Mic className="size-4 text-cyan-soft" />
            <p className="truncate text-sm text-white">&quot;{command}&quot;</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Notifications() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <a className="text-xs text-cyan-soft" href="#assistant">View All</a>
      </CardHeader>
      <div className="space-y-3">
        {recentActions.slice(0, 3).map((item) => (
          <div key={item.title} className="flex gap-3 rounded-md bg-black/24 p-3">
            <div className={cn("grid size-9 place-items-center rounded-md border", toneClass[item.tone])}>
              <Bell className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
            </div>
            <span className="text-xs text-muted-foreground">{item.time}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function QuickAccess() {
  return (
    <Card id="quick-access">
      <CardHeader>
        <CardTitle>Quick Access</CardTitle>
      </CardHeader>
      <div className="grid grid-cols-3 gap-2">
        {knowledgeBlocks.slice(0, 9).map((block) => (
          <div key={block.label} className="rounded-md border border-cyan-electric/10 bg-black/24 p-3 text-center">
            <block.icon className="mx-auto size-5 text-cyan-soft" />
            <p className="mt-2 text-xs text-muted-foreground">{block.label}</p>
            <p className="mt-1 truncate text-xs text-white">{block.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-cyan-electric/14 bg-cyan-electric/8 px-3 py-2">
        <div className="flex items-center gap-3 text-sm text-cyan-soft">
          <Mic className="size-4" />
          Listening...
          <VoiceWave className="ml-auto w-32" />
        </div>
      </div>
    </Card>
  );
}

function BottomDock() {
  const items = [
    ["Understand", "I listen & understand", Home],
    ["Think", "I analyze & think", Database],
    ["Act", "I take action", Zap],
    ["Learn", "I learn & improve", CloudMoon]
  ];

  return (
    <footer className="glass mt-4 rounded-lg p-4">
      <div className="grid gap-3 md:grid-cols-[220px_1fr_280px] md:items-center">
        <p className="text-3xl font-semibold tracking-[0.18em] text-cyan-soft">D.A.N.I.S.H</p>
        <div className="grid gap-2 sm:grid-cols-4">
          {items.map(([title, subtitle, Icon]) => {
            const RealIcon = Icon as typeof Home;
            return (
              <div key={title as string} className="flex items-center gap-3 rounded-md border border-cyan-electric/10 bg-black/18 p-3">
                <RealIcon className="size-5 text-cyan-soft" />
                <div>
                  <p className="text-sm font-medium text-white">{title as string}</p>
                  <p className="text-xs text-muted-foreground">{subtitle as string}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-center text-sm text-muted-foreground md:text-right">
          &quot;I&apos;m not just an assistant,
          <br />
          I&apos;m your partner in every mission.&quot;
        </p>
      </div>
    </footer>
  );
}
