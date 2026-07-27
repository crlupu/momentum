"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
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
}: {
  /** Name of the thing being deleted, shown in the dialog. */
  what: string;
  onDelete: () => Promise<unknown>;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = usePending();

  const confirm = async () => {
    const ok = await run(onDelete);
    if (ok !== false) setOpen(false);
  };

  return (
    <>
      <Button
        size={size}
        variant="danger"
        className={[fullWidth ? "w-full" : "", className].filter(Boolean).join(" ")}
        onPress={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        {label}
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
            className={pending ? "is-pending" : ""}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
