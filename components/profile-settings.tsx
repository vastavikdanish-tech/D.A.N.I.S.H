"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Save, Loader2, CheckCircle, AlertCircle, Mic } from "lucide-react";

type UserProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export function ProfileSettings() {
  const { getAccessToken } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [wakeWord, setWakeWord] = useState("Hello Danish");

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
      try {
        const res = await authFetch("/api/profile");
        const json = await res.json();
        if (json?.ok && json.data) {
          setProfile(json.data);
          setDisplayName(json.data.display_name || "");
          setBio(json.data.bio || "");
          setTimezone(json.data.timezone || "UTC");
        }
        const storedWakeWord = typeof window !== "undefined" ? localStorage.getItem("danish_wake_word") : null;
        if (storedWakeWord) setWakeWord(storedWakeWord);
      } catch (e) {
        console.error("Failed to load profile:", e);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [authFetch]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await authFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          bio: bio.trim() || undefined,
          timezone: timezone.trim(),
        }),
      });
      const json = await res.json();

      if (json?.ok && json.data) {
        setProfile(json.data);
        localStorage.setItem("danish_wake_word", wakeWord.trim());
        setSuccess("Profile saved successfully!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(json?.error || "Failed to save profile.");
      }
    } catch {
      setError("Unable to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="min-h-[200px]">
        <div className="flex h-[200px] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-cyan-soft" />
        </div>
      </Card>
    );
  }

  return (
    <Card id="profile-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Profile Settings
          {success && (
            <CheckCircle className="size-5 text-mint animate-pulse" />
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your display name, bio, timezone, and avatar.
        </p>
      </CardHeader>
      <div className="space-y-4">
        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="rounded-md bg-danger/10 border border-danger/20 p-3 text-sm text-danger flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="display_name" className="text-sm font-medium text-white">
              Display Name
            </label>
            <div className="relative">
              <input
                id="display_name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-cyan-electric disabled:opacity-50"
                disabled={saving}
                required
                maxLength={100}
              />
            </div>
            <p className="text-xs text-muted-foreground">This is how you&apos;ll be greeted throughout D.A.N.I.S.H.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="bio" className="text-sm font-medium text-white">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself&hellip;"
              rows={3}
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-cyan-electric disabled:opacity-50 resize-none"
              disabled={saving}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{bio.length}/500 characters</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="timezone" className="text-sm font-medium text-white">
              Timezone
            </label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-cyan-electric disabled:opacity-50"
              disabled={saving}
            >
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="America/New_York">Eastern Time (US & Canada)</option>
              <option value="America/Chicago">Central Time (US & Canada)</option>
              <option value="America/Denver">Mountain Time (US & Canada)</option>
              <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="Europe/Paris">Paris (CET/CEST)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
              <option value="Asia/Kolkata">Kolkata (IST)</option>
              <option value="Australia/Sydney">Sydney (AEST/AEDT)</option>
            </select>
            <p className="text-xs text-muted-foreground">Used for reminder scheduling and timestamps.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Avatar</label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {profile?.avatar_url ? (
                  <div
                    className="size-16 rounded-full border-2 border-cyan-electric/30"
                    style={{
                      backgroundImage: `url(${profile.avatar_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                ) : (
                  <div className="grid size-16 place-items-center rounded-full border-2 border-cyan-electric/30 bg-cyan-electric/10">
                    <span className="text-2xl font-semibold text-cyan-soft">
                      {profile?.display_name ? profile.display_name.slice(0, 2).toUpperCase() : "AU"}
                    </span>
                  </div>
                )}
                <label className="absolute bottom-0 right-0 cursor-pointer">
                  <Camera className="size-5 text-cyan-soft bg-black rounded-full p-1" />
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={saving}
                  />
                </label>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Avatar upload coming soon. Currently using initials.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="wake_word" className="text-sm font-medium text-white">
              Wake Word
            </label>
            <div className="relative">
              <Mic className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cyan-soft" />
              <input
                id="wake_word"
                type="text"
                value={wakeWord}
                onChange={(e) => setWakeWord(e.target.value)}
                placeholder="Hello Danish"
                className="w-full rounded-md border border-white/10 bg-transparent pl-10 pr-3 py-2 text-sm text-white outline-none focus:border-cyan-electric disabled:opacity-50"
                disabled={saving}
                maxLength={30}
              />
            </div>
            <p className="text-xs text-muted-foreground">Say this phrase to activate hands-free voice mode.</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={saving} className="min-w-[140px]">
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            {success && (
              <span className="text-sm text-mint flex items-center gap-1">
                <CheckCircle className="size-4" />
                Saved
              </span>
            )}
          </div>
        </form>
      </div>
    </Card>
  );
}