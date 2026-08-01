"use client";

import { useCallback, useState } from "react";
import { Button } from "./ui";

/**
 * Tracks pending state around an async action, so a button can refuse a second
 * press while the first is still in flight.
 *
 * Nothing is drawn from this any more. It used to be held for a minimum time
 * so the indicator couldn't just flash, but with the indicator gone that delay
 * only kept the button dead longer than the work took.
 */
export function usePending() {
  const [pending, setPending] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setPending(true);
    try {
      return await fn();
    } finally {
      setPending(false);
    }
  }, []);
  return { pending, run };
}

type Props = React.ComponentProps<typeof Button> & {
  /** Async action. The button is held disabled until it settles. */
  onAction: () => Promise<unknown>;
};

/**
 * Button that guards against a second press while its write is in flight.
 * There is no longer a visual indicator: writes are applied locally before the
 * network call, so by the time anything could be shown the change is already
 * on screen, and an animation over it only suggested it hadn't landed yet.
 */
export function ActionButton({ onAction, className, isDisabled, children, ...rest }: Props) {
  const { pending, run } = usePending();
  return (
    <Button
      {...rest}
      isDisabled={isDisabled || pending}
      className={className}
      onPress={() => {
        if (!pending) void run(onAction);
      }}
    >
      {children}
    </Button>
  );
}
