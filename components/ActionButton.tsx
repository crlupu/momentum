"use client";

import { useCallback, useState } from "react";
import { Button } from "@heroui/react";

/** Tracks pending state around an async action. */
export function usePending() {
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setPending(true);
      try {
        return await fn();
      } finally {
        setPending(false);
      }
    },
    []
  );
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
