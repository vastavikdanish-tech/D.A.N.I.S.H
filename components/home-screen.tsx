"use client";

import { motion } from "framer-motion";
import {
  Brain,
  Laptop,
  Bell,
  Zap,
  BookOpen,
  Briefcase,
  Heart,
  Settings,
  Mic,
} from "lucide-react";
import { AiOrb } from "@/components/ai-orb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BriefingData } from "@/components/command-center";
import type { Screen } from "@/components/app-shell";

const modules = [
  { id: "memory", label: "Memory", icon: Brain, color: "from-mint/20 to-mint/5", border: "border-mint/20" },
  { id: "devices", label: "Devices", icon: Laptop, color: "from-cyan/20 to-cyan/5", border: "border-cyan/20" },
  { id: "reminders", label: "Reminders", icon: Bell, color: "from-amber/20 to-amber/5", border: "border-amber/20" },
  { id: "automation", label: "Automation", icon: Zap, color: "from-purple/20 to-purple/5", border: "border-purple/20" },
  { id: "study", label: "Study OS", icon: BookOpen, color: "from-emerald/20 to-emerald/5", border: "border-emerald/20" },
  { id: "career", label: "Career OS", icon: Briefcase, color: "from-sky/20 to-sky/5", border: "border-sky/20" },
  { id: "health", label: "Health", icon: Heart, color: "from-rose/20 to-rose/5", border: "border-rose/20" },
  { id: "settings", label: "Settings", icon: Settings, color: "from-white/10 to-white/5", border: "border-white/10" },
];

export function HomeScreen({
  onNavigate,
  onCommand,
  wakeWord,
  orbState,
  briefing,
  onMicToggle,
}: {
  onNavigate: (screen: Screen) => void;
  onCommand: (msg: string) => Promise<string | null>;
  wakeWord: string;
  orbState: "off" | "listening" | "thinking" | "speaking";
  briefing: BriefingData | null;
  onMicToggle?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 pt-6 sm:pt-10">
      {/* AI Orb */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <AiOrb state={orbState} />
      </motion.div>

      {/* Greeting */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mt-6 text-xl font-medium text-white sm:text-2xl"
      >
        {briefing?.greeting || "Welcome"}
      </motion.p>

      {/* Quick Status */}
      {briefing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mt-4 flex gap-4 text-sm text-muted-foreground"
        >
          {briefing.reminders > 0 && <span>{briefing.reminders} reminder{briefing.reminders > 1 ? "s" : ""}</span>}
          {briefing.devicesTotal > 0 && <span>{briefing.devicesOnline}/{briefing.devicesTotal} devices</span>}
          {briefing.goals.length > 0 && <span>{briefing.goals.length} goal{briefing.goals.length > 1 ? "s" : ""}</span>}
        </motion.div>
      )}

      {/* Command Input + Voice */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="mt-8 flex w-full items-center gap-3"
      >
        <form
          onSubmit={(e) => { e.preventDefault(); const el = e.currentTarget.elements.namedItem("cmd") as HTMLInputElement; if (el?.value) { onCommand(el.value); el.value = ""; }}}
          className="flex h-12 flex-1 items-center gap-3 rounded-xl border border-cyan-electric/14 bg-black/40 px-4 focus-within:border-cyan-electric/40 backdrop-blur-sm"
        >
          <input
            name="cmd"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-muted-foreground"
            placeholder={`Ask anything or say "${wakeWord}"`}
          />
          <button type="submit" className="hidden" />
        </form>
        <Button variant="secondary" size="icon" className="size-12 shrink-0 rounded-xl" onClick={onMicToggle}>
          <Mic className="size-5" />
        </Button>
      </motion.div>

      {/* Feature Launcher Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="mt-10 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
      >
        {modules.map((mod, i) => (
          <motion.button
            key={mod.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.06, duration: 0.35 }}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate(mod.id as Screen)}
            className={cn(
              "group flex flex-col items-center gap-3 rounded-xl border bg-gradient-to-b p-5 text-center transition-all",
              mod.border, mod.color,
              "hover:border-cyan-electric/30 hover:shadow-[0_0_20px_rgba(53,217,255,0.1)]"
            )}
          >
            <div className="grid size-12 place-items-center rounded-xl bg-black/30 border border-white/5 group-hover:border-cyan-electric/30 transition-colors">
              <mod.icon className="size-6 text-cyan-soft" />
            </div>
            <span className="text-sm font-medium text-white">{mod.label}</span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
