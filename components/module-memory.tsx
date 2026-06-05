"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

type MemoryFact = {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  created_at: string;
};

export function ModuleMemory({ authFetch }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [prefs, setPrefs] = useState<MemoryFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fRes, pRes] = await Promise.all([
        authFetch("/api/memories/facts"),
        authFetch("/api/memories/facts?category=preference"),
      ]);
      const fJson = await fRes.json();
      const pJson = await pRes.json();
      if (fJson?.ok) setFacts(fJson.data || []);
      if (pJson?.ok) setPrefs(pJson.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const filteredFacts = search
    ? facts.filter((f) => f.body.toLowerCase().includes(search.toLowerCase()))
    : facts;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="size-6 text-cyan-soft" />
        <h1 className="text-xl font-semibold text-white">Memory</h1>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search memories..."
        className="w-full rounded-xl border border-cyan-electric/14 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-muted-foreground"
      />

      {prefs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <span className="text-xs text-muted-foreground">{prefs.length} saved</span>
          </CardHeader>
          <div className="space-y-2 px-3 pb-3">
            {prefs.map((p) => (
              <div key={p.id} className="rounded-lg bg-black/20 px-3 py-2 text-sm text-white">{p.body}</div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Facts</CardTitle>
          <span className="text-xs text-muted-foreground">{loading ? "..." : `${filteredFacts.length} fact${filteredFacts.length !== 1 ? "s" : ""}`}</span>
        </CardHeader>
        <div className="space-y-2 px-3 pb-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : filteredFacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search ? "No matching facts found." : "No facts yet. Say things like \"I like coffee\" and I'll remember."}
            </p>
          ) : (
            filteredFacts.map((f) => (
              <div key={f.id} className="flex items-start gap-3 rounded-lg bg-black/20 px-3 py-2">
                <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded bg-mint/10 text-xs text-mint">
                  {f.category === "preference" ? "P" : "F"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">{f.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
