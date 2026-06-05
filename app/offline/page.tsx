"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white px-6">
      <div className="grid size-20 place-items-center rounded-2xl border border-cyan-electric/30 bg-cyan-electric/10 mb-6">
        <span className="text-4xl">📡</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">You&apos;re Offline</h1>
      <p className="text-center text-sm text-muted-foreground max-w-sm mb-8">
        D.A.N.I.S.H needs a network connection to assist you. 
        Cached data is still available in the app.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-xl bg-cyan-electric/15 border border-cyan-electric/30 px-6 py-3 text-sm font-medium text-cyan-soft hover:bg-cyan-electric/25 transition"
      >
        Try Again
      </button>
    </div>
  );
}
