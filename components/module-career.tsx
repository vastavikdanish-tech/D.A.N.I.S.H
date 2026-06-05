"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, ExternalLink, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Job = {
  id: string;
  title: string;
  company?: string;
  location?: string;
  url?: string;
};

type SavedJob = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export function ModuleCareer({ authFetch }: { authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [saved, setSaved] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jRes, mRes] = await Promise.all([
        authFetch("/api/jobs"),
        authFetch("/api/memories?category=career"),
      ]);
      const jJson = await jRes.json();
      const mJson = await mRes.json();
      if (jJson?.ok) setJobs(jJson.data || []);
      if (mJson?.ok) setSaved(mJson.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const saveJob = async () => {
    if (!title.trim()) return;
    try {
      await authFetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), company: company.trim(), tags: ["career"] }),
      });
      setTitle("");
      setCompany("");
      setShowForm(false);
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="size-5 text-sky" />
          <h2 className="text-lg font-semibold text-white">Career OS</h2>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="size-4 mr-1" />
          Track Job
        </Button>
      </div>

      {showForm && (
        <Card>
          <div className="p-4 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Job title"
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-sky"
              autoFocus
            />
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company name"
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-sky"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveJob} disabled={!title.trim()}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {!loading && jobs.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">RECOMMENDED POSITIONS</p>
          <div className="space-y-2">
            {jobs.map((j) => (
              <Card key={j.id}>
                <div className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-white">{j.title}</p>
                    <p className="text-xs text-muted-foreground">{j.company}{j.location ? ` — ${j.location}` : ""}</p>
                  </div>
                  {j.url && (
                    <a href={j.url} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="ghost">
                        <ExternalLink className="size-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {saved.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground mt-4">TRACKED POSITIONS</p>
          <div className="space-y-2">
            {saved.map((s) => {
              let parsed: Record<string, string> = {};
              try { parsed = JSON.parse(s.body); } catch { parsed = { title: s.title }; }
              return (
                <Card key={s.id}>
                  <div className="p-4">
                    <p className="text-sm font-medium text-white">{parsed.title || s.title}</p>
                    {parsed.company && <p className="text-xs text-muted-foreground">{parsed.company}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">Saved {new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
    </div>
  );
}
