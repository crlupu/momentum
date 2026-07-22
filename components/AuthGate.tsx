"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Input } from "@heroui/react";
import { Tracker } from "@/lib/tracker";

export function AuthGate({
  tracker,
  children,
}: {
  tracker: Tracker;
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Local-only mode (Firebase not set up yet): just run the app.
  if (!tracker.firebaseConfigured) return <>{children}</>;

  // Waiting for Firebase to report auth state.
  if (!tracker.authReady) {
    return <p className="pt-10 text-center text-foreground/60">Connecting…</p>;
  }

  // Signed in: show the app.
  if (tracker.user) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signin") await tracker.signIn(email.trim(), password);
    else await tracker.signUp(email.trim(), password);
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-sm px-4 pt-10">
      <Card>
        <Card.Content className="p-5 sm:p-6">
          <h2 className="font-display mb-1 text-xl font-bold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mb-4 text-sm text-foreground/60">
            {mode === "signin"
              ? "Sign in to sync your progress across devices."
              : "Your tasks, board, and history will sync everywhere you sign in."}
          </p>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <Input
              type="email"
              aria-label="Email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                tracker.clearAuthError();
              }}
              autoComplete="email"
            />
            <Input
              type="password"
              aria-label="Password"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                tracker.clearAuthError();
              }}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />

            {tracker.authError && (
              <p className="text-sm text-danger" role="alert">
                {tracker.authError}
              </p>
            )}

            <Button type="submit" variant="primary" isDisabled={busy} className="mt-1">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            className="mt-4 w-full text-center text-sm text-foreground/60 hover:text-foreground"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              tracker.clearAuthError();
            }}
          >
            {mode === "signin"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </Card.Content>
      </Card>
    </div>
  );
}
