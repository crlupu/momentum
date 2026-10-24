import { ReactNode } from "react";

/**
 * What an empty list shows: one icon, a title, one line on what fills it,
 * and at most one action. The same everywhere, so day one reads as an
 * invitation rather than a grey sentence.
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={"empty-state card" + (className ? " " + className : "")}>
      <span className="empty-state__icon" aria-hidden>
        {icon}
      </span>
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__text">{children}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
