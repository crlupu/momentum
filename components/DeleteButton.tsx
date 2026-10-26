"use client";

import { useState } from "react";
import { Button } from "./ui";
import { DeleteGlyph } from "./DeleteGlyph";
import { Minus } from "./icons";
import { Modal } from "./Modal";
import { usePending } from "./ActionButton";
import { DialogActions } from "./DialogActions";

/**
 * The one delete button, as iOS draws it: on a row, the red trash on a quiet disc; with a label,
 * the word in red on a soft red ground. Always asks before deleting. In a pop-up
 * it belongs in DialogActions; on a list row it is icon-only.
 */
export function DeleteButton({
  what,
  onDelete,
  label = "Delete",
  size = "sm",
  className,
  fullWidth,
  iconOnly,
  dash,
  bare,
}: {
  /** Name of the thing being deleted, shown in the dialog. */
  what: string;
  onDelete: () => Promise<unknown>;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  fullWidth?: boolean;
  /** Render just the trash icon (still confirms before deleting). */
  iconOnly?: boolean;
  /** With iconOnly: a red dash on a soft red disc instead of the trash, as an edit list shows it. */
  dash?: boolean;
  /** @deprecated Every delete is the soft red one now; kept so callers compile. */
  bare?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = usePending();

  const confirm = async () => {
    // Close on the press. The delete is applied locally before it is sent, so
    // waiting for the round trip left the dialog sitting over a row that had
    // already gone. A refused delete is rolled back by the store, so the
    // dialog comes back to be confirmed again.
    setOpen(false);
    const ok = await run(onDelete);
    if (ok === false) setOpen(true);
  };

  return (
    <>
      {iconOnly ? (
        <button type="button" className="minus-delete" aria-label={`Delete ${what}`} onClick={() => setOpen(true)}>
          {dash ? (
            <span className="icon-disc icon-disc--danger icon-disc--soft-danger"><Minus /></span>
          ) : (
            <span className="icon-disc icon-disc--danger"><DeleteGlyph /></span>
          )}
        </button>
      ) : (
        <Button
          size={size}
          variant="ghost"
          className={[fullWidth ? "w-full" : "", "btn-delete-bare", className].filter(Boolean).join(" ")}
          onPress={() => setOpen(true)}
        >
          {label}
        </Button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Confirm deletion">
        <p className="mb-1 text-[15px]">
          Delete <span className="font-semibold">{what}</span>?
        </p>
        <p className="mb-4 text-sm text-[var(--muted)]">This can&apos;t be undone.</p>
        <DialogActions
          primary={{ label: "Delete", onPress: () => void confirm(), disabled: pending, danger: true }}
        />
      </Modal>
    </>
  );
}
