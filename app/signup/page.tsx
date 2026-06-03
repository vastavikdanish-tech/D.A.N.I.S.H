"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();
  const { signUp, session, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && session) {
      router.replace("/");
    }
  }, [session, isLoading, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signUp(email, password);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error || "Unable to create account. Please try again.");
      return;
    }

    router.push("/");
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-md p-6 text-white">
      <div className="space-y-6 rounded-3xl border border-white/10 bg-black/70 p-8 shadow-glow">
        <div>
          <h1 className="text-3xl font-semibold">Create account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Register a new D.A.N.I.S.H account with email and password.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-white">
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white outline-none focus:border-cyan-electric"
              required
            />
          </label>
          <label className="block text-sm font-medium text-white">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white outline-none focus:border-cyan-electric"
              required
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Sign Up"}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-cyan-soft hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
