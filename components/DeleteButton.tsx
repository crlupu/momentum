"use client";

import { useState } from "react";
import { Button } from "./ui";
import { Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { usePending } from "./ActionButton";

/**
 * A full delete button (icon + text, danger colour) that always asks for
 * confirmation before running the deletion.
 */
export function DeleteButton({
  what,
  onDelete,
  label = "Delete",
  size = "sm",
  className,
  fullWidth,
  iconOnly,
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
  /**
   * Drop the filled background and colour the icon itself instead. For lists
   * where a solid danger button on every row would shout louder than the rows.
   */
  bare?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = usePending();

  const confirm = async () => {
    // Close on the press. The delete is applied locally before it is sent, so
    // waiting for the round trip left the dialog sitting over a row that had
    // already gone. A refused delete is rolled back by the store, so the
    // dialog comes back to be confirmed again; the sync banner says why.
    setOpen(false);
    const ok = await run(onDelete);
    if (ok === false) setOpen(true);
  };

  return (
    <>
      <Button
        size={size}
        variant={bare ? "ghost" : "danger"}
        isIconOnly={iconOnly}
        aria-label={iconOnly ? `Delete ${what}` : undefined}
        className={[fullWidth ? "w-full" : "", bare ? "btn-delete-bare" : "", className]
          .filter(Boolean)
          .join(" ")}
        onPress={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        {!iconOnly && label}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Confirm deletion">
        <p className="mb-1 text-[15px]">
          Delete <span className="font-semibold">{what}</span>?
        </p>
        <p className="mb-4 text-sm text-foreground/60">This can&apos;t be undone.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onPress={() => setOpen(false)} isDisabled={pending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onPress={() => void confirm()}
            isDisabled={pending}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
