"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { HomeScreen } from "@/components/home-screen";
import { LogOut, Command, Mic, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BriefingData } from "@/components/command-center";

export type Screen = "home" | "memory" | "devices" | "reminders" | "automation" | "study" | "career" | "health" | "settings";

const navItems: { id: Screen; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "memory", label: "Memory" },
  { id: "devices", label: "Devices" },
  { id: "reminders", label: "Reminders" },
  { id: "automation", label: "Automation" },
  { id: "study", label: "Study" },
  { id: "career", label: "Career" },
  { id: "health", label: "Health" },
  { id: "settings", label: "Settings" },
];

type ChatMessage = { role: string; text: string };

export function AppShell({
  orbState,
  onCommand,
  wakeWord,
  briefing,
  renderModule,
  onMicToggle,
  currentScreen,
  onNavigate,
  voiceServiceOnline,
  messages,
  voiceState,
  onSubmitMessage,
}: {
  orbState: "off" | "listening" | "thinking" | "speaking";
  onCommand: (msg: string) => Promise<string | null>;
  wakeWord: string;
  briefing: BriefingData | null;
  renderModule?: (screen: Screen) => React.ReactNode;
  onMicToggle?: () => void;
  currentScreen?: Screen;
  onNavigate?: (screen: Screen) => void;
  voiceServiceOnline?: boolean;
  messages?: ChatMessage[];
  voiceState?: "off" | "listening" | "thinking" | "speaking";
  onSubmitMessage?: (msg: string) => void;
}) {
  const { user, signOut } = useAuth();
  const [internalScreen, setInternalScreen] = useState<Screen>("home");
  const screen = currentScreen ?? internalScreen;
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNavigate = useCallback((s: Screen) => {
    if (onNavigate) {
      onNavigate(s);
    } else {
      setInternalScreen(s);
    }
  }, [onNavigate]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    onSubmitMessage?.(input.trim());
    setInput("");
  }, [input, onSubmitMessage]);

  const displayName = user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl">
      {/* Desktop Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-white/5 p-4 lg:flex lg:flex-col">
        <div className="flex items-center gap-3 pb-6 border-b border-white/5">
          <div className="grid size-10 place-items-center rounded-lg bg-cyan-electric/10 border border-cyan-electric/30">
            <Command className="size-5 text-cyan-electric" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">D.A.N.I.S.H</p>
            <p className="text-[10px] text-muted-foreground">AI Operating System</p>
          </div>
        </div>

        <div className="flex items-center gap-3 py-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-electric/10 text-xs font-semibold text-cyan-soft border border-cyan-electric/20">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{displayName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.email || ""}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                screen === item.id
                  ? "bg-cyan-electric/12 text-white"
                  : "text-muted-foreground hover:text-white hover:bg-white/[0.04]"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-danger transition"
        >
          <LogOut className="size-4" />
          Sign Out
        </button>

        <div className="mt-4 flex items-center gap-2 px-3 text-[10px] text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", voiceServiceOnline === false ? "bg-red-500" : "bg-green-500")} />
          Voice {voiceServiceOnline === false ? "Offline" : "Online"}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-white/5 px-4 py-3 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-lg bg-cyan-electric/10 border border-cyan-electric/30">
              <Command className="size-4 text-cyan-electric" />
            </div>
            <span className="text-sm font-semibold text-white">D.A.N.I.S.H</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-cyan-electric/10 text-[10px] font-semibold text-cyan-soft">
              {initials}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {screen === "home" ? (
            <HomeScreen
              onNavigate={handleNavigate}
              onCommand={onCommand}
              wakeWord={wakeWord}
              orbState={orbState}
              briefing={briefing}
              onMicToggle={onMicToggle}
            />
          ) : (
            <div className="p-4 sm:p-6">
              <button
                onClick={() => handleNavigate("home")}
                className="mb-4 text-sm text-cyan-soft hover:text-cyan-electric transition"
              >
                &larr; Back to Home
              </button>
              {renderModule ? renderModule(screen) : null}
            </div>
          )}
        </main>

        {/* Chat bar - always visible */}
        <div className="border-t border-white/5 bg-black/60 backdrop-blur-lg">
          {/* Messages */}
          {messages && messages.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2 px-4 py-3 border-b border-white/5">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <span className={cn("max-w-[80%] rounded-2xl px-3 py-1.5 text-xs leading-relaxed", msg.role === "user" ? "bg-cyan-electric/15 text-white rounded-br-sm" : "bg-white/5 text-white/70 rounded-bl-sm")}>
                    {msg.text}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
          {/* Input row */}
          <div className="flex items-center gap-2 px-4 py-2.5">
            <button
              type="button"
              onClick={onMicToggle}
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full transition",
                voiceState === "listening" ? "bg-red-500/20 text-red-400" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
              )}
            >
              <Mic className="size-4" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder={voiceState === "listening" ? "Listening..." : "Ask D.A.N.I.S.H..."}
              className="flex-1 bg-transparent text-sm text-white/80 outline-none placeholder:text-white/30"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className="grid size-8 shrink-0 place-items-center rounded-full text-white/40 hover:text-cyan-soft transition disabled:opacity-30"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <nav className="flex items-center overflow-x-auto gap-1 border-t border-white/5 bg-black/80 backdrop-blur-lg px-2 py-1.5 lg:hidden scrollbar-none">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-0.5 px-2.5 py-1 text-[10px] transition rounded-lg",
                screen === item.id
                  ? "text-cyan-soft"
                  : "text-muted-foreground"
              )}
            >
              <span className={cn("size-1.5 rounded-full", screen === item.id ? "bg-cyan-soft" : "bg-transparent")} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
