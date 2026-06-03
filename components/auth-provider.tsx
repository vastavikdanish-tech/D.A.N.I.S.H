"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

type AuthContextValue = {
  supabase: ReturnType<typeof createClient>;
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ ok: boolean; error: string | null }>;
  signOut: () => Promise<void>;
  getAccessToken: () => string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    };

    init();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password })
      });
      const result = await response.json();
      if (!result.ok) {
        return { ok: false, error: result.error || "Unable to sign in." };
      }
      const sessionData = result.session;
      if (sessionData) {
        const { error } = await supabase.auth.setSession(sessionData);
        if (error) {
          return { ok: false, error: error.message };
        }
        setSession(sessionData);
        setUser(sessionData.user ?? null);
        return { ok: true, error: null };
      }
      return { ok: false, error: "Missing sign-in session." };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unable to sign in." };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signup", email, password })
      });
      const result = await response.json();
      if (!result.ok) {
        return { ok: false, error: result.error || "Unable to create account." };
      }
      const sessionData = result.session;
      if (sessionData) {
        const { error } = await supabase.auth.setSession(sessionData);
        if (error) {
          return { ok: false, error: error.message };
        }
        setSession(sessionData);
        setUser(sessionData.user ?? null);
        return { ok: true, error: null };
      }
      return { ok: false, error: "Account created. Please sign in." };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unable to create account." };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out error:", error.message);
    }
    setSession(null);
    setUser(null);
  };

  const getAccessToken = () => session?.access_token ?? null;

  const value = useMemo(
    () => ({ supabase, session, user, isLoading, signIn, signUp, signOut, getAccessToken }),
    [supabase, session, user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
