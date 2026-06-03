"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { CommandCenter } from "@/components/command-center";

export default function AuthGate() {
  const { session, user, isLoading, signOut } = useAuth();

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl p-6 text-center text-white">
        <p className="text-xl font-semibold">Restoring your session...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl p-6 text-center text-white">
        <div className="rounded-3xl border border-white/10 bg-black/70 p-10 shadow-glow">
          <h1 className="text-4xl font-semibold tracking-tight">Welcome to D.A.N.I.S.H</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Sign in to restore your personal AI workspace, memory manager, and secure data.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/login">
              <Button className="min-w-[140px]">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button variant="secondary" className="min-w-[140px]">
                Create Account
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1720px] p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/60 p-4 text-white shadow-glow">
        <div>
          <p className="text-sm uppercase text-cyan-soft">Signed in as</p>
          <p className="text-lg font-semibold">{user?.email ?? "Authenticated user"}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="secondary">Home</Button>
          </Link>
          <Button variant="danger" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>
      <CommandCenter />
    </div>
  );
}
