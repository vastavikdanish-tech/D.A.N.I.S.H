"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  Bell,
  CalendarDays,
  CirclePower,
  Laptop,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { executeAction } from "@/lib/action-engine";
import dynamic from "next/dynamic";
import { ModuleMemory } from "@/components/module-memory";
import { ProfileSettings } from "@/components/profile-settings";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";
import { useVoiceEngine } from "@/lib/use-voice-engine";
import { usePwa } from "@/lib/use-pwa";
import { PwaInstallPrompt } from "@/components/pwa/install-prompt";

export type BriefingData = {
  greeting: string;
  reminders: number;
  upNext: { id: string; title: string; due_at: string }[];
  goals: { title: string; progress: number }[];
  devicesOnline: number;
  devicesTotal: number;
};

const ModuleAutomation = dynamic(() => import("@/components/module-automation").then(m => ({ default: m.ModuleAutomation })), { ssr: false });
const ModuleStudy = dynamic(() => import("@/components/module-study").then(m => ({ default: m.ModuleStudy })), { ssr: false });
const ModuleCareer = dynamic(() => import("@/components/module-career").then(m => ({ default: m.ModuleCareer })), { ssr: false });
const ModuleHealth = dynamic(() => import("@/components/module-health").then(m => ({ default: m.ModuleHealth })), { ssr: false });
export function CommandCenter() {
  const { getAccessToken, user } = useAuth();
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([]);

  useEffect(() => {
    const saved = localStorage.getItem("danish_messages");
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("danish_messages", JSON.stringify(messages.slice(-50)));
  }, [messages]);
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
        const storedWakeWord = typeof window !== "undefined" ? localStorage.getItem("danish_wake_word") : null;
        setWakeWord(storedWakeWord || json.data.wake_word || "Hello Danish");
        if (!json.data.display_name) {
          setShowOnboarding(true);
        }
      }
    } catch (e) {
      console.error("Failed to load profile:", e);
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
  }, []);

  usePwa();

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

  useEffect(() => {
    if (wakeWord) voice.setWakeWord(wakeWord);
  }, [wakeWord, voice]);

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
      <PwaInstallPrompt />
      <AppShell
      orbState={voice.state}
      onCommand={submitAssistant}
      wakeWord={wakeWord}
      briefing={briefing}
      onMicToggle={handleMicToggle}
      currentScreen={screen}
      onNavigate={setScreen}
      voiceServiceOnline={voice.voiceServiceOnline}
      messages={messages}
      voiceState={voice.state}
      onSubmitMessage={(msg) => submitAssistant(msg)}
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
    />
    </>
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


