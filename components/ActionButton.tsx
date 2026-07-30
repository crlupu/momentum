"use client";

import { useCallback, useState } from "react";
import { Button } from "./ui";

/** Minimum time the pending state stays visible, so it never just flashes. */
/* Long enough that the indicator is perceptible, short enough that an
   optimistic change doesn't appear to still be in flight. */
const MIN_PENDING_MS = 350;

/** Tracks pending state around an async action. */
export function usePending() {
  const [pending, setPending] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setPending(true);
    const startedAt = Date.now();
    try {
      return await fn();
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_PENDING_MS) {
        await new Promise((r) => setTimeout(r, MIN_PENDING_MS - elapsed));
      }
      setPending(false);
    }
  }, []);
  return { pending, run };
}

type Props = React.ComponentProps<typeof Button> & {
  /** Async action; the button shows a cycling border until it settles. */
  onAction: () => Promise<unknown>;
};

/**
 * Button that shows a cycling border while its write is in flight.
 */
export function ActionButton({ onAction, className, isDisabled, children, ...rest }: Props) {
  const { pending, run } = usePending();
  return (
    <Button
      {...rest}
      isDisabled={isDisabled || pending}
      className={[className, pending ? "is-pending" : ""].filter(Boolean).join(" ")}
      onPress={() => {
        if (!pending) void run(onAction);
      }}
    >
      {children}
    </Button>
  );
}
