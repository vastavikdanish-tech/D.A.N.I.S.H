"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Clock, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Session = {
  id: string;
  subject: string;
  duration_minutes: number;
  notes?: string | null;
  created_at: string;
};

export function ModuleStudy({ authFetch }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("30");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/study");
      const json = await res.json();
      if (json?.ok) setSessions(json.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const logSession = async () => {
    if (!subject.trim() || !duration) return;
    try {
      await authFetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          duration_minutes: parseInt(duration) || 30,
          notes: notes.trim() || null,
        }),
      });
      setSubject("");
      setDuration("30");
      setNotes("");
      load();
    } catch { /* ignore */ }
  };

  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration_minutes, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="size-5 text-mint" />
        <h2 className="text-lg font-semibold text-white">Study OS</h2>
      </div>

      <Card>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">LOG A STUDY SESSION</p>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (e.g. Python, Math)"
            className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-mint"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min={1}
              max={600}
              className="w-24 rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-mint"
            />
            <span className="flex items-center text-xs text-muted-foreground">minutes</span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-mint resize-none"
          />
          <Button size="sm" onClick={logSession} disabled={!subject.trim()}>
            <Plus className="size-4 mr-1" />
            Log Session
          </Button>
        </div>
      </Card>

      {!loading && sessions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Total: <span className="text-white font-medium">{totalMinutes}</span> minutes across{" "}
          <span className="text-white font-medium">{sessions.length}</span> sessions
        </p>
      )}

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No study sessions logged yet.</p>
        ) : (
          sessions.map((s) => (
            <Card key={s.id}>
              <div className="flex items-center gap-3 p-4">
                <Clock className="size-4 shrink-0 text-mint" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{s.subject}</p>
                  <p className="text-xs text-muted-foreground">{s.duration_minutes} min{s.notes ? ` — ${s.notes}` : ""}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
