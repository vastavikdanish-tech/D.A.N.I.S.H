"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  Bell,
  CalendarDays,
  CirclePower,
  Laptop,
  Mic,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { executeAction } from "@/lib/action-engine";
import dynamic from "next/dynamic";
import { ModuleMemory } from "@/components/module-memory";
import { ProfileSettings } from "@/components/profile-settings";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";
import { useVoiceEngine } from "@/lib/use-voice-engine";

const ModuleAutomation = dynamic(() => import("@/components/module-automation").then(m => ({ default: m.ModuleAutomation })), { ssr: false });
const ModuleStudy = dynamic(() => import("@/components/module-study").then(m => ({ default: m.ModuleStudy })), { ssr: false });
const ModuleCareer = dynamic(() => import("@/components/module-career").then(m => ({ default: m.ModuleCareer })), { ssr: false });
const ModuleHealth = dynamic(() => import("@/components/module-health").then(m => ({ default: m.ModuleHealth })), { ssr: false });

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

export type BriefingData = {
  greeting: string;
  reminders: number;
  upNext: { id: string; title: string; due_at: string }[];
  goals: { title: string; progress: number }[];
  devicesOnline: number;
  devicesTotal: number;
};

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

function waitForSpeechVoices(timeoutMs = 2500) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve([]);

  const immediateVoices = getSpeechVoices();
  if (immediateVoices.length > 0) return Promise.resolve(immediateVoices);

  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let settled = false;

    const finish = (_reason: string) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);

      const voices = getSpeechVoices();
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
  wake_word?: string;
  created_at: string;
  updated_at: string;
};

export function CommandCenter() {
  const { getAccessToken, user } = useAuth();
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [wakeWord, setWakeWord] = useState<string>("Hello Danish");

  type Screen = "home" | "memory" | "devices" | "reminders" | "automation" | "study" | "career" | "health" | "settings";
  const [screen, setScreen] = useState<Screen>("home");

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

  const loadProfile = useCallback(async () => {
    if (!user?.email) {
      return;
    }
    try {
      const res = await authFetch("/api/profile");
      const json = await res.json();
      if (json?.ok && json.data) {
        setProfile(json.data);
        const storedWakeWord = typeof window !== "undefined" ? localStorage.getItem("danish_wake_word") : null;
        setWakeWord(storedWakeWord || json.data.wake_word || "Hello Danish");
        if (!json.data.display_name) {
          setShowOnboarding(true);
        }
      }
    } catch (e) {
      console.error("Failed to load profile:", e);
    } finally {
      setProfileLoading(false);
    }
  }, [authFetch, user?.email]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    let mounted = true;
    async function checkNotifications() {
      try {
        const res = await authFetch("/api/notifications");
        const json = await res.json();
        if (!mounted || !json?.ok || !json.data?.length) return;
        for (const reminder of json.data) {
          if (!mounted) break;
          const n = new Notification(reminder.title || "Reminder", {
            body: reminder.body || "Your reminder is due.",
            tag: reminder.id,
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        }
      } catch {
      }
    }
    checkNotifications();
    const interval = setInterval(checkNotifications, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [authFetch]);

  const voice = useVoiceEngine();
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    const storedWakeWord = typeof window !== "undefined" ? localStorage.getItem("danish_wake_word") : null;
    if (storedWakeWord) setWakeWord(storedWakeWord);
    loadProfile();
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const navigate = useCallback((sectionId: string) => {
    const screens: Screen[] = ["home", "memory", "devices", "reminders", "automation", "study", "career", "health", "settings"];
    if (screens.includes(sectionId as Screen)) {
      setScreen(sectionId as Screen);
    }
  }, []);

  const submitAssistant = useCallback(async (message: string, mode: string = "assistant") => {
    if (!message) return null;

    const actionResult = await executeAction(message, { authFetch, navigate });
    if (actionResult) {
      setMessages((prev) => [...prev, { role: "user", text: message }]);
      setMessages((prev) => [...prev, { role: "assistant", text: actionResult.message }]);
      voiceRef.current.speakSentences(actionResult.message);
      return actionResult.message;
    }

    try {
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
        voiceRef.current.speakSentences(content);
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
  }, [authFetch, navigate]);

  const handleTranscript = useCallback(async (message: string) => {
    const navPatterns: Record<string, Screen> = {
      "go to home": "home", "open home": "home", "navigate home": "home",
      "go to memory": "memory", "open memory": "memory", "show memory": "memory", "navigate to memory": "memory",
      "go to devices": "devices", "open devices": "devices", "show devices": "devices", "navigate to devices": "devices",
      "go to reminders": "reminders", "open reminders": "reminders", "show reminders": "reminders", "navigate to reminders": "reminders",
      "go to automation": "automation", "open automation": "automation", "show automation": "automation",
      "go to study": "study", "open study": "study", "show study": "study",
      "go to career": "career", "open career": "career", "show career": "career",
      "go to health": "health", "open health": "health", "show health": "health", "navigate to health": "health",
      "go to settings": "settings", "open settings": "settings", "show settings": "settings",
    };
    const lower = message.toLowerCase().trim();
    const target = navPatterns[lower];
    if (target) {
      setScreen(target);
      const labels: Record<string, string> = { home: "Home", memory: "Memory", devices: "Devices", reminders: "Reminders", automation: "Automation", study: "Study", career: "Career", health: "Health", settings: "Settings" };
      const reply = `Navigating to ${labels[target]}.`;
      setMessages((prev) => [...prev, { role: "user", text: message }]);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      voiceRef.current.speakSentences(reply);
      return reply;
    }
    return submitAssistant(message);
  }, [submitAssistant]);

  voice.setOnTranscript(handleTranscript);

  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [orbState, setOrbState] = useState<"off" | "listening" | "thinking" | "speaking">("off");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/briefing");
        const json = await res.json();
        if (json?.ok) setBriefing(json.data);
      } catch { /* ignore */ }
    })();
  }, [authFetch]);

  const handleMicToggle = useCallback(() => {
    voice.toggleListening();
  }, [voice]);

  return (
    <>
      <Onboarding isOpen={showOnboarding} onComplete={handleOnboardingComplete} />
      <AppShell
      orbState={orbState}
      onCommand={submitAssistant}
      wakeWord={wakeWord}
      briefing={briefing}
      onMicToggle={handleMicToggle}
      currentScreen={screen}
      onNavigate={setScreen}
      voiceServiceOnline={voice.voiceServiceOnline}
      renderModule={(screen) => {
        switch (screen) {
          case "memory": return <ModuleMemory authFetch={authFetch} />;
          case "devices": return <RemoteControl authFetch={authFetch} />;
          case "reminders": return <RemindersPanel authFetch={authFetch} />;
          case "settings": return <ProfileSettings />;
          case "automation":
            return <ModuleAutomation authFetch={authFetch} />;
          case "study":
            return <ModuleStudy authFetch={authFetch} />;
          case "career":
            return <ModuleCareer authFetch={authFetch} />;
          case "health":
            return <ModuleHealth authFetch={authFetch} />;
          default: return null;
        }
      }}
    >
      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.target as HTMLFormElement).querySelector("input");
              if (input?.value.trim()) {
                submitAssistant(input.value.trim());
                input.value = "";
              }
            }}
            className="flex flex-1 items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask D.A.N.I.S.H..."
              className="flex-1 bg-transparent text-sm text-white/80 outline-none placeholder:text-white/30"
            />
            <button type="submit" className="hidden" />
          </form>
          <button type="button" onClick={handleMicToggle} className="ml-auto flex items-center gap-1 text-xs text-cyan-soft hover:text-cyan-electric transition">
            <Mic className="size-4 shrink-0" />
            {voice.state === "listening" ? "Listening..." : voice.state === "speaking" ? "Speaking..." : voice.state === "thinking" ? "Thinking..." : "Voice"}
          </button>
        </header>
        <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed", msg.role === "user" ? "bg-cyan-electric/20 text-white rounded-br-md" : "bg-white/5 text-white/80 rounded-bl-md")}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <VoiceAssistant onSendMessage={submitAssistant} wakeWord={wakeWord} onStateChange={setOrbState} />
      </div>
    </AppShell>
    </>
  );
}

function VoiceAssistant({ onSendMessage, wakeWord, onStateChange }: { onSendMessage: (msg: string) => Promise<string | null>; wakeWord: string; onStateChange?: (state: "off" | "listening" | "thinking" | "speaking") => void }) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const activatedRef = useRef(false);
  const speakingRef = useRef(false);
  const recognitionPausedRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechQueueRef = useRef<Promise<void>>(Promise.resolve());
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const pttRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [voiceState, setVoiceState] = useState<"off" | "listening" | "thinking" | "speaking">("off");
  const [status, setStatus] = useState("Wake word off");
  const [lastTranscript, setLastTranscript] = useState("");

  const updateVoiceState = useCallback((state: "off" | "listening" | "thinking" | "speaking") => {
    setVoiceState(state);
    onStateChange?.(state);
  }, [onStateChange]);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.cancel();
    }
    speakingRef.current = false;
    cancelSpeechRef.current = null;
  }, []);

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
      return Promise.resolve();
    }

    const speechText = text.trim();
    if (!speechText) return Promise.resolve();

    const speakOnce = async () => {
      const voices = await waitForSpeechVoices();
      const { selectedVoice, selectedLang } = selectSpeechVoice(speechText, voices);
      pauseRecognition("tts-start");
      updateVoiceState("speaking");

      return new Promise<void>((resolve) => {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
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
        const finish = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          speakingRef.current = false;
          cancelSpeechRef.current = null;
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
          resolve();
        };

        const timeoutId = window.setTimeout(() => {
          finish();
        }, 60000);

        cancelSpeechRef.current = () => {
          if (!settled) {
            window.speechSynthesis.cancel();
            finish();
          }
        };

        utterance.onend = () => finish();
        utterance.onerror = () => finish();
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
        setStatus(activatedRef.current ? "Listening for your command..." : `Listening for "${wakeWord}"...`);
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
  }, [enabled, wakeWord]);

  const processCommand = useCallback(async (command: string) => {
    const cleaned = command.trim();
    if (!cleaned) return;
    stopSpeaking();
    pauseRecognition("processing-command");
    updateVoiceState("thinking");
    setStatus("Thinking...");
    const response = await onSendMessage(cleaned);
    if (response) {
      updateVoiceState("speaking");
      setStatus("Speaking...");
      await speak(response);
    }
    recognitionPausedRef.current = false;
    updateVoiceState("listening");
    setStatus("Listening for your command...");
    restartListening();
  }, [onSendMessage, pauseRecognition, restartListening, speak, stopSpeaking]);

  const handleTranscript = useCallback(async (transcript: string) => {
    const cleaned = transcript.trim();
    const normalized = cleaned.toLowerCase();
    setLastTranscript(cleaned);

    if (speakingRef.current && activatedRef.current) {
      stopSpeaking();
      pauseRecognition("interrupted");
    }

    if (!activatedRef.current) {
      const wakeLower = wakeWord.toLowerCase();
      if (!normalized.includes(wakeLower) || Date.now() < cooldownUntilRef.current) return;

      cooldownUntilRef.current = Date.now() + 3500;
      activatedRef.current = true;
      activatedRef.current = true;
      updateVoiceState("speaking");
      setStatus("Activated");
      pauseRecognition("wake-word");
      await speak(`${wakeWord}, how can I help you today?`);

      const wakePattern = wakeWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const commandAfterWake = cleaned.replace(new RegExp(wakePattern, "i"), "").trim();
      if (commandAfterWake) {
        await processCommand(commandAfterWake);
      } else {
        recognitionPausedRef.current = false;
        updateVoiceState("listening");
        setStatus("Listening for your command...");
        restartListening();
      }
      return;
    }

    pauseRecognition("command-captured");
    await processCommand(cleaned);
  }, [pauseRecognition, processCommand, restartListening, speak, wakeWord, stopSpeaking]);

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
      activatedRef.current = false;
      recognitionPausedRef.current = false;
      speakingRef.current = false;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      updateVoiceState("off");
      setStatus("Wake word off");
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
      return;
    }

    setSupported(true);
    setEnabled(true);
    updateVoiceState("listening");
    setStatus(`Listening for "${wakeWord}"...`);
  };

  const handlePushToTalk = useCallback(() => {
    stopSpeaking();
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    let finalTranscript = "";
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript;
      }
      if (finalTranscript) setLastTranscript(finalTranscript);
    };
    recognition.onend = () => {
      if (finalTranscript) {
        updateVoiceState("thinking");
        setStatus("Thinking...");
        processCommand(finalTranscript);
      }
    };
    pttRecognitionRef.current = recognition;
    updateVoiceState("listening");
    setStatus("Push to talk...");
    recognition.start();
  }, [stopSpeaking, processCommand]);

  const releasePushToTalk = useCallback(() => {
    if (pttRecognitionRef.current) {
      pttRecognitionRef.current.stop();
      pttRecognitionRef.current = null;
    }
  }, []);

  return (
    <div className="mt-5 w-full max-w-xl rounded-lg border border-cyan-electric/14 bg-black/28 p-3 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant={enabled ? "secondary" : "primary"} onClick={toggleListening}>
          <Mic className="size-4" />
          {enabled ? "Stop Voice" : "Start Voice"}
        </Button>
        {enabled && (
          <button
            type="button"
            onMouseDown={handlePushToTalk}
            onMouseUp={releasePushToTalk}
            onMouseLeave={releasePushToTalk}
            onTouchStart={handlePushToTalk}
            onTouchEnd={releasePushToTalk}
            className="flex items-center gap-1.5 rounded-md border border-cyan-electric/30 bg-cyan-electric/12 px-3 py-1.5 text-xs font-medium text-cyan-soft transition active:scale-95 hover:bg-cyan-electric/20 select-none"
          >
            <span className="relative flex size-3">
              {voiceState === "listening" && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-electric/60" />
              )}
              <span className="relative inline-flex size-3 rounded-full bg-cyan-electric" />
            </span>
            Hold to Talk
          </button>
        )}
        <span className={cn(
          "flex items-center gap-1.5 text-xs",
          voiceState === "speaking" ? "text-mint" :
          voiceState === "thinking" ? "text-amber" :
          voiceState === "listening" ? "text-cyan-soft" :
          "text-muted-foreground"
        )}>
          {voiceState === "speaking" && <span className="inline-flex gap-0.5"><span className="size-1 animate-bounce rounded-full bg-mint [animation-delay:0ms]" /><span className="size-1 animate-bounce rounded-full bg-mint [animation-delay:150ms]" /><span className="size-1 animate-bounce rounded-full bg-mint [animation-delay:300ms]" /></span>}
          {voiceState === "thinking" && <span className="inline-flex gap-0.5"><span className="size-1 animate-pulse rounded-full bg-amber" /><span className="size-1 animate-pulse rounded-full bg-amber [animation-delay:200ms]" /><span className="size-1 animate-pulse rounded-full bg-amber [animation-delay:400ms]" /></span>}
          {status}
        </span>
      </div>
      <p className="mt-2 min-h-5 truncate text-xs text-muted-foreground">
        {supported ? lastTranscript || (enabled ? `Say "${wakeWord}" to activate.` : "Use Chrome or Edge for speech recognition.") : "Use Chrome or Edge for speech recognition."}
      </p>
    </div>
  );
}

type DeviceEntry = {
  id?: string;
  name?: string;
  device_type?: string;
  health?: Record<string, unknown> | null;
  created_at?: string;
  last_seen?: string;
};

type DeviceCommandEntry = {
  id: string;
  command: string;
  status: string;
  created_at: string;
  result?: Record<string, unknown> | null;
};

const RemoteControl = React.memo(function RemoteControl({ authFetch }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  const [devices, setDevices] = useState<DeviceEntry[]>([]);
  const [commands, setCommands] = useState<DeviceCommandEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const res = await authFetch("/api/devices");
      const json = await res.json();
      if (json?.ok && json?.data) setDevices(json.data);
    } catch { /* ignore */ }
    try {
      const res = await authFetch("/api/devices/audit");
      const json = await res.json();
      if (json?.ok && json?.data) setCommands(json.data.slice(0, 10));
    } catch { /* ignore */ }
    setLoading(false);
  }, [authFetch]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  async function queueDeviceAction(action: string, deviceId?: string) {
    setPendingAction(action);
    setActionStatus(null);
    try {
      const res = await authFetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deviceId ? { deviceId, action } : { device_type: "laptop", action })
      });
      const json = await res.json();
      setActionStatus(json?.ok
        ? (json.queued ? `${action.replace(/_/g, " ")} queued.` : json.message || "Sent.")
        : json?.error || "Failed."
      );
    } catch {
      setActionStatus("Unable to reach device command API.");
    } finally {
      setPendingAction(null);
    }
  }

  async function approveDevice(deviceId: string) {
    setApproving(deviceId);
    setActionStatus(null);
    try {
      const res = await authFetch("/api/devices/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId })
      });
      const json = await res.json();
      if (json?.ok) {
        setActionStatus("Device approved! Refresh to see commands flowing.");
      } else {
        setActionStatus(json?.error || "Approval failed.");
      }
      loadDevices();
    } catch {
      setActionStatus("Approval request failed.");
    } finally {
      setApproving(null);
    }
  }

  async function generatePairingToken() {
    setGenerating(true);
    setActionStatus(null);
    try {
      const res = await authFetch("/api/devices/pairing-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json?.ok) {
        setPairingToken(json.token);
      } else {
        setActionStatus(json?.error || "Failed to generate token.");
      }
    } catch {
      setActionStatus("Unable to generate token.");
    } finally {
      setGenerating(false);
    }
  }

  const onlineDevices = devices.filter((d) => d.health?.status === "online");
  const pendingDevices = devices.filter((d) => !d.health?.approved);

  return (
    <Card id="remote" className="min-h-[410px]">
      <CardHeader>
        <CardTitle>Remote Control</CardTitle>
        <span className="text-xs text-muted-foreground">
          {loading ? "Loading..." : `${onlineDevices.length} device${onlineDevices.length !== 1 ? "s" : ""} online`}
        </span>
      </CardHeader>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-sm text-muted-foreground">Loading devices...</span>
        </div>
      ) : (
        <>
          {/* Online Devices */}
          {onlineDevices.map((device) => (
            <div key={device.id} className="mb-3 flex items-center gap-3">
              <div className="relative grid size-10 place-items-center rounded-md bg-mint/10 text-mint">
                <Laptop className="size-5" />
                <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-mint shadow-[0_0_6px_#00ff88]" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">{device.name}</p>
                <p className="text-xs text-muted-foreground">{device.device_type} &middot; Online</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => queueDeviceAction("lock_pc", device.id)} disabled={Boolean(pendingAction)}>
                <CirclePower className="size-4" />
              </Button>
            </div>
          ))}

          {/* Pending Devices (not yet approved) */}
          {pendingDevices.map((device) => (
            <div key={device.id} className="mb-3 flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="grid size-10 place-items-center rounded-md bg-amber/10 text-amber">
                <Smartphone className="size-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">{device.name || "New Device"}</p>
                <p className="text-xs text-muted-foreground">Pending approval</p>
              </div>
              <Button size="sm" variant="secondary" disabled={approving === device.id} onClick={() => device.id && approveDevice(device.id)}>
                {approving === device.id ? "Approving..." : "Approve"}
              </Button>
            </div>
          ))}

          {/* Add Device / Pairing Token Generator */}
          <div className="mb-4 rounded-lg border border-cyan-electric/14 bg-black/35 p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">ADD DEVICE</p>
            {pairingToken ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Run this command on your Windows PC:</p>
                <div className="rounded-md bg-black/40 p-2">
                  {(() => {
                    const origin = typeof window !== "undefined" ? window.location.origin : "https://your-server.com";
                    const cmd = `.\\windows-agent.ps1 -ServerUrl "${origin}" -PairingToken "${pairingToken}" -DeviceName "$env:COMPUTERNAME"`;
                    return <code className="block break-all text-xs text-cyan-soft">{cmd}</code>;
                  })()}
                </div>
                {(() => {
                  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-server.com";
                  const cmd = `.\\windows-agent.ps1 -ServerUrl "${origin}" -PairingToken "${pairingToken}" -DeviceName "$env:COMPUTERNAME"`;
                  return (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(cmd); setActionStatus("Copied!"); }}>
                        Copy Command
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => { setPairingToken(null); generatePairingToken(); }}>
                        Regenerate
                      </Button>
                    </>
                  );
                })()}
              </div>
            ) : (
              <Button size="sm" variant="secondary" disabled={generating} onClick={generatePairingToken}>
                {generating ? "Generating..." : "Generate Pairing Token"}
              </Button>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-4 rounded-lg border border-cyan-electric/14 bg-black/35 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Quick Actions</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={Boolean(pendingAction)} onClick={() => queueDeviceAction("open_chrome")}>
                Chrome
              </Button>
              <Button variant="secondary" size="sm" disabled={Boolean(pendingAction)} onClick={() => queueDeviceAction("open_vscode")}>
                VS Code
              </Button>
              <Button variant="secondary" size="sm" disabled={Boolean(pendingAction)} onClick={() => queueDeviceAction("lock_pc")}>
                Lock
              </Button>
              <Button variant="danger" size="sm" disabled={Boolean(pendingAction)} onClick={() => queueDeviceAction("shutdown_pc")}>
                Shutdown
              </Button>
            </div>
          </div>

          {/* Recent Commands */}
          {commands.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Recent Commands</p>
              <div className="space-y-1">
                {commands.map((cmd) => (
                  <div key={cmd.id} className="flex items-center justify-between rounded-md bg-black/20 px-3 py-1.5">
                    <span className="text-xs text-white">{cmd.command.replace(/_/g, " ")}</span>
                    <span className={`text-xs ${cmd.status === "executed" ? "text-mint" : cmd.status === "failed" ? "text-danger" : "text-amber"}`}>
                      {cmd.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {actionStatus ? <p className="mt-3 text-xs text-mint">{actionStatus}</p> : null}
        </>
      )}
    </Card>
  );
});



const RemindersPanel = React.memo(function RemindersPanel({ authFetch }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
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
});


