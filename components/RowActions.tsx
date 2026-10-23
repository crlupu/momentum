"use client";

import { IconButton } from "./IconButton";
import { DeleteButton } from "./DeleteButton";
import { Pencil } from "./icons";

/**
 * The one pair of actions at the end of a list row: a tinted pencil and the
 * red trash, both on the same quiet disc (IconButton). Either can be
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
        <IconButton label={`${editLabel} ${name}`} onPress={onEdit}>
          <span className="icon-disc"><Pencil /></span>
        </IconButton>
      )}
      {del && <DeleteButton what={del.what} iconOnly onDelete={del.onDelete} />}
    </>
  );
}
