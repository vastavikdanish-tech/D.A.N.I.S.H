"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, Square, Plus, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Automation = {
  id: string;
  title: string;
  description?: string | null;
  trigger?: Record<string, unknown>;
  steps?: Record<string, unknown>[];
  enabled?: boolean;
  created_at?: string;
};

export function ModuleAutomation({ authFetch }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/automations");
      const json = await res.json();
      if (json?.ok) setAutomations(json.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!title.trim()) return;
    try {
      await authFetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      setTitle("");
      setShowForm(false);
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-amber" />
          <h2 className="text-lg font-semibold text-white">Automations</h2>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="size-4 mr-1" />
          New
        </Button>
      </div>

      {showForm && (
        <Card>
          <div className="p-4 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Workflow name..."
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-amber"
              onKeyDown={(e) => e.key === "Enter" && create()}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={create} disabled={!title.trim()}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : automations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No automations yet. Create your first workflow.</p>
        ) : (
          automations.map((a) => (
            <Card key={a.id}>
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-white">{a.title}</p>
                  {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-block size-1.5 rounded-full ${a.enabled ? "bg-mint" : "bg-muted-foreground"}`} />
                    <span className="text-[10px] text-muted-foreground">{a.enabled ? "Active" : "Inactive"}</span>
                  </div>
                </div>
                <Button size="icon" variant="ghost">
                  {a.enabled ? <Square className="size-4" /> : <Play className="size-4" />}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
