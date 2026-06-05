"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Heart, Droplets, Brain, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "health" | "sleep" | "mood";

type HealthEntry = { id: string; date: string; sleep_hours: number | null; food: Record<string, unknown> | null; water_ml: number | null; mood: string | null; notes: string | null };
type SleepEntry = { id: string; date: string; duration_minutes: number | null; quality: number | null; notes: string | null };
type MoodEntry = { id: string; date: string; mood: string; intensity: number | null; notes: string | null };

export function ModuleHealth({ authFetch }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  const [tab, setTab] = useState<Tab>("health");
  const [healthData, setHealthData] = useState<HealthEntry[]>([]);
  const [sleepData, setSleepData] = useState<SleepEntry[]>([]);
  const [moodData, setMoodData] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [hr, sr, mr] = await Promise.all([
        authFetch("/api/health"),
        authFetch("/api/sleep"),
        authFetch("/api/mood"),
      ]);
      const [hj, sj, mj] = await Promise.all([hr.json(), sr.json(), mr.json()]);
      if (hj.ok) setHealthData(hj.data);
      if (sj.ok) setSleepData(sj.data);
      if (mj.ok) setMoodData(mj.data);
    } catch {} finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabs: { id: Tab; label: string; icon: typeof Moon }[] = [
    { id: "health", label: "Daily Health", icon: Heart },
    { id: "sleep", label: "Sleep", icon: Moon },
    { id: "mood", label: "Mood", icon: Brain },
  ];

  const handleAddHealth = async () => {
    const res = await authFetch("/api/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: new Date().toISOString().split("T")[0] }),
    });
    if (res.ok) fetchData();
  };

  const handleAddSleep = async () => {
    const res = await authFetch("/api/sleep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: new Date().toISOString().split("T")[0] }),
    });
    if (res.ok) fetchData();
  };

  const handleAddMood = async () => {
    const moods = ["happy", "calm", "neutral", "sad", "anxious", "energetic"];
    const mood = moods[Math.floor(Math.random() * moods.length)];
    const res = await authFetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood, intensity: 5 }),
    });
    if (res.ok) fetchData();
  };

  if (loading) return <div className="p-4 text-white/40 text-sm">Loading health data...</div>;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs transition", tab === t.id ? "bg-cyan-electric/20 text-cyan-soft" : "text-white/40 hover:text-white/70")}>
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Health */}
      {tab === "health" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">Daily logs</p>
            <Button onClick={handleAddHealth} size="sm" variant="ghost" className="text-cyan-soft gap-1"><Plus className="size-3" /> Log Today</Button>
          </div>
          {healthData.length === 0 && <p className="text-white/20 text-xs py-8 text-center">No health logs yet.</p>}
          {healthData.map((e) => (
            <Card key={e.id} className="flex items-center gap-4 rounded-xl border-white/5 bg-white/[0.03] p-4">
              <Heart className="size-5 text-rose-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60">{new Date(e.date).toLocaleDateString()}</p>
                <div className="flex gap-4 mt-1 text-sm text-white/80">
                  {e.sleep_hours != null && <span className="flex items-center gap-1"><Moon className="size-3" />{e.sleep_hours}h</span>}
                  {e.water_ml != null && <span className="flex items-center gap-1"><Droplets className="size-3" />{e.water_ml}ml</span>}
                  {e.mood && <span className="flex items-center gap-1"><Brain className="size-3" />{e.mood}</span>}
                </div>
                {e.notes && <p className="text-xs text-white/40 mt-1">{e.notes}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Sleep */}
      {tab === "sleep" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">Sleep logs</p>
            <Button onClick={handleAddSleep} size="sm" variant="ghost" className="text-cyan-soft gap-1"><Plus className="size-3" /> Log Tonight</Button>
          </div>
          {sleepData.length === 0 && <p className="text-white/20 text-xs py-8 text-center">No sleep logs yet.</p>}
          {sleepData.map((e) => (
            <Card key={e.id} className="flex items-center gap-4 rounded-xl border-white/5 bg-white/[0.03] p-4">
              <Moon className="size-5 text-indigo-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60">{new Date(e.date).toLocaleDateString()}</p>
                <div className="flex gap-4 mt-1 text-sm text-white/80">
                  {e.duration_minutes != null && <span>{Math.round(e.duration_minutes / 60)}h {e.duration_minutes % 60}m</span>}
                  {e.quality != null && <span>Quality: {e.quality}/10</span>}
                </div>
                {e.notes && <p className="text-xs text-white/40 mt-1">{e.notes}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Mood */}
      {tab === "mood" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">Mood logs</p>
            <Button onClick={handleAddMood} size="sm" variant="ghost" className="text-cyan-soft gap-1"><Plus className="size-3" /> Log Mood</Button>
          </div>
          {moodData.length === 0 && <p className="text-white/20 text-xs py-8 text-center">No mood logs yet.</p>}
          {moodData.map((e) => (
            <Card key={e.id} className="flex items-center gap-4 rounded-xl border-white/5 bg-white/[0.03] p-4">
              <Brain className={cn("size-5 shrink-0", e.mood === "happy" ? "text-amber-400" : e.mood === "calm" ? "text-emerald-400" : e.mood === "sad" ? "text-blue-400" : e.mood === "anxious" ? "text-orange-400" : "text-white/40")} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60">{new Date(e.date).toLocaleString()}</p>
                <p className="text-sm text-white/80 capitalize mt-1">{e.mood} {e.intensity != null && <span className="text-white/40">· {e.intensity}/10</span>}</p>
                {e.notes && <p className="text-xs text-white/40 mt-1">{e.notes}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
