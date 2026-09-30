"use client";

import { ReactNode } from "react";
import { Button } from "./ui";
import { DeleteButton } from "./DeleteButton";
import { Trash2 } from "./icons";

/**
 * The one footer for every pop-up, so they all read the same way: a delete
 * (when there is one) and any extra actions on the left, Cancel and the main
 * action on the right. Delete sits apart from Save so it's never pressed on
 * the way to it, and always asks first.
 *
 * The main action submits the surrounding form unless it is given an
 * onPress, so a form's own onSubmit — Enter included — stays the one path.
 */
export function DialogActions({
  onCancel,
  cancelLabel = "Cancel",
  primary,
  del,
  extra,
}: {
  onCancel?: () => void;
  cancelLabel?: string;
  primary?: {
    label: ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    /** A destructive main action (confirming a removal) is red. */
    danger?: boolean;
  };
  del?:
    | {
        /** Named in the confirmation: `Delete "Atomic Habits"?` */
        what: string;
        onDelete: () => Promise<unknown>;
      }
    | {
        /** Opens a confirmation of its own, for a delete with choices to make. */
        onPress: () => void;
      }
    | null
    | false;
  /** Secondary actions, shown after delete on the left. */
  extra?: ReactNode;
}) {
  const left = del || extra;
  return (
    <div className="dialog-actions">
      {left && (
        <div className="dialog-actions__side">
          {del &&
            ("onPress" in del ? (
              <Button variant="ghost" className="btn-delete-bare" onPress={del.onPress}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : (
              <DeleteButton what={del.what} onDelete={del.onDelete} size="md" />
            ))}
          {extra}
        </div>
      )}
      <div className="dialog-actions__main">
        {onCancel && (
          <Button variant="outline" onPress={onCancel}>
            {cancelLabel}
          </Button>
        )}
        {primary && (
          <Button
            type={primary.onPress ? "button" : "submit"}
            variant={primary.danger ? "danger" : "primary"}
            className={primary.danger ? "btn-danger-solid" : undefined}
            onPress={primary.onPress}
            isDisabled={primary.disabled}
          >
            {primary.label}
          </Button>
        )}
      </div>
    </div>
  );
}
