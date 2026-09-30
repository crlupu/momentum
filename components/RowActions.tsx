"use client";

import { Button } from "./ui";
import { DeleteButton } from "./DeleteButton";
import { Pencil } from "./icons";

/**
 * The one pair of actions at the end of a list row: an outlined pencil and
 * the red bin, both icon-only and the same size everywhere. Either can be
 * left out. Goes inside the row's own actions group (.cfg-actions).
 */
export function RowActions({
  name,
  onEdit,
  editLabel = "Edit",
  del,
}: {
  /** What the row is, for the buttons' names: "Edit Push day". */
  name: string;
  onEdit?: () => void;
  /** "Rename" where the pencil only renames. */
  editLabel?: string;
  del?: { what: string; onDelete: () => Promise<unknown> };
}) {
  return (
    <>
      {onEdit && (
        <Button size="sm" variant="outline" isIconOnly aria-label={`${editLabel} ${name}`} onPress={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {del && <DeleteButton what={del.what} iconOnly onDelete={del.onDelete} />}
    </>
  );
}
