"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Input } from "@heroui/react";
import { Tracker } from "@/lib/tracker";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

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

          <Button
            variant="outline"
            className="w-full"
            onPress={() => tracker.signInWithGoogle()}
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <div className="my-4 flex items-center gap-3 text-xs text-foreground/40">
            <span className="h-px flex-1 bg-foreground/10" />
            or
            <span className="h-px flex-1 bg-foreground/10" />
          </div>

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
