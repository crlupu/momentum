"use client";

import { ReactNode } from "react";
import { AddButton } from "./ui";

/**
 * The one card: a title above it — with a colour dot and a line under it when
 * there is one — its actions on the right of the title, and the content in
 * the card below. Every section of the app is built from these, so the add
 * and edit of any card are in the same place and look the same.
 *
 * Actions come as props rather than as buttons: `onAdd` is the small +,
 * `onEdit` the word "Edit" (the convention for "change this"), and `actions`
 * anything else, placed before them. Pass `bare` for content that draws its
 * own card or rows.
 */
export function Panel({
  title,
  dot,
  subtitle,
  onAdd,
  addLabel,
  onEdit,
  editLabel = "Edit",
  editPressed,
  actions,
  bare,
  className,
  bodyClassName,
  style,
  children,
  ...rest
}: {
  title: ReactNode;
  /** A colour to mark it by: a track's, a category's. */
  dot?: string;
  subtitle?: ReactNode;
  onAdd?: () => void;
  /** Named for assistive tech: "Add a book to Technical". */
  addLabel?: string;
  onEdit?: () => void;
  /** "Done" while a card is being edited in place. */
  editLabel?: string;
  editPressed?: boolean;
  actions?: ReactNode;
  /** No card around the content. */
  bare?: boolean;
  className?: string;
  bodyClassName?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
  "aria-label"?: string;
}) {
  const name = typeof title === "string" ? title : undefined;
  const side = actions || onAdd || onEdit;
  return (
    <section className={["panel", className].filter(Boolean).join(" ")} style={style} aria-label={rest["aria-label"] ?? name}>
      <div className="panel-head">
        <div className="panel-head__text">
          <h2 className="panel-head__title">
            {dot && <span className="panel-head__dot" style={{ background: dot }} aria-hidden />}
            {title}
          </h2>
          {subtitle && <div className="panel-head__sub">{subtitle}</div>}
        </div>
        {side && (
          <div className="panel-head__side">
            {actions}
            {onEdit && (
              <button
                type="button"
                className="text-action"
                aria-label={name ? `${editLabel} ${name}` : undefined}
                aria-pressed={editPressed}
                onClick={onEdit}
              >
                {editLabel}
              </button>
            )}
            {onAdd && <AddButton size="sm" secondary aria-label={addLabel ?? (name ? `Add to ${name}` : "Add")} onPress={onAdd} />}
          </div>
        )}
      </div>
      {bare ? children : <div className={["card p-4 md:p-5", bodyClassName].filter(Boolean).join(" ")}>{children}</div>}
    </section>
  );
}
