"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "./icons";

export type CardFigure = { value: ReactNode; label: ReactNode; href?: string; warn?: boolean };
export type CardBand = { label: ReactNode; content?: ReactNode; action?: ReactNode; href?: string; onPress?: () => void };

/**
 * Every summary card in the app, in the anatomy of Today's card, so they all
 * read the same way: a caps label with something on its right, one figure
 * (or a title) with what it counts, an optional line, the visual (tiles,
 * bars, a sparkline), at most two actions, a hairline band leading to the
 * page behind, and a row of three figures. Each card uses the parts it needs.
 */
export function SummaryCard({
  label,
  aside,
  done,
  doneLabel = "All done",
  figure,
  detail,
  side,
  title,
  line,
  children,
  actions,
  band,
  figures,
  className,
  "aria-label": ariaLabel,
}: {
  label: ReactNode;
  aside?: ReactNode;
  /** Finished: the glow, and the badge in place of the aside. */
  done?: boolean;
  doneLabel?: string;
  /** The number, in light figures. */
  figure?: ReactNode;
  /** What the figure counts, muted, on its line. */
  detail?: ReactNode;
  /**
   * In place of `detail`: two rows beside the figure, the unit a little
   * larger on top and a quiet hint (a change, a date) under it.
   */
  side?: { unit: ReactNode; hint?: ReactNode };
  /** A name in place of a figure: "Pull A", "Step 5". */
  title?: ReactNode;
  line?: ReactNode;
  /** The visual. */
  children?: ReactNode;
  actions?: ReactNode;
  band?: CardBand;
  figures?: CardFigure[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <section className={"momentum summary-card" + (done ? " momentum--done" : "") + (className ? " " + className : "")} aria-label={ariaLabel}>
      <div className="momentum__top">
        <div className="momentum__head">
          <p className="eyebrow">{label}</p>
          {done ? (
            <span className="momentum__badge">
              <Check aria-hidden />
              {doneLabel}
            </span>
          ) : (
            aside != null && <span className="summary-card__aside">{aside}</span>
          )}
        </div>
        {(figure != null || title != null || line != null) && (
          <div>
            {figure != null ? (
              <p className={"momentum__count" + (side ? " has-side" : "")}>
                <span className="font-mono-n momentum__headline">{figure}</span>
                {side ? (
                  <span className="summary-card__side">
                    <span className="summary-card__unit">{side.unit}</span>
                    {side.hint != null && <span className="summary-card__hint">{side.hint}</span>}
                  </span>
                ) : (
                  detail != null && <span className="momentum__detail">{detail}</span>
                )}
              </p>
            ) : title != null ? (
              <p className="summary-card__title">
                {title}
                {detail != null && <span className="momentum__detail"> {detail}</span>}
              </p>
            ) : null}
            {line != null && <p className="momentum__detail momentum__next">{line}</p>}
          </div>
        )}
        {children}
        {actions && <div className="summary-card__actions">{actions}</div>}
      </div>
      {band && <Band band={band} />}
      {figures && figures.length > 0 && (
        <ul className="momentum__figures summary-card__figures" style={{ gridTemplateColumns: `repeat(${figures.length}, minmax(0, 1fr))` }}>
          {figures.map((f, i) => (
            <li key={i}>
              {f.href ? (
                <Link href={f.href} className="momentum__figure">
                  <FigureBody f={f} />
                </Link>
              ) : (
                <span className="momentum__figure">
                  <FigureBody f={f} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FigureBody({ f }: { f: CardFigure }) {
  return (
    <>
      <span className={"font-mono-n momentum__value" + (f.warn ? " is-warn" : "")}>{f.value}</span>
      <span className="momentum__label">{f.label}</span>
    </>
  );
}

function Band({ band }: { band: CardBand }) {
  const inner = (
    <>
      <span className="plan-card__week-label">{band.label}</span>
      <span className="plan-card__week-rings summary-card__band-text">{band.content}</span>
      {band.action != null && (
        <span className="plan-card__week-goals">
          {band.action}
          {(band.href || band.onPress) && <ChevronRight aria-hidden />}
        </span>
      )}
    </>
  );
  if (band.href)
    return (
      <Link href={band.href} className="plan-card__week">
        {inner}
      </Link>
    );
  if (band.onPress)
    return (
      <button type="button" className="plan-card__week summary-card__band-btn" onClick={band.onPress}>
        {inner}
      </button>
    );
  return <div className="plan-card__week">{inner}</div>;
}

/** Every tile row in the app is eight to a line, so a tile is the same size on every card. */
export const TILE_COLUMNS = 8;

/**
 * Tiles in a row: the visual for things made of parts (steps, meals,
 * exercises). Always Today's size: eight to a line, more only when there are
 * more than eight, so they stay on one row. Names go to the tooltip and
 * screen readers; the card's line or the list under it says them.
 */
export function CardTiles({
  items,
}: {
  items: { key: string; icon: ReactNode; label?: ReactNode; state: "done" | "next" | "todo"; title?: string }[];
}) {
  const n = Math.max(items.length, TILE_COLUMNS);
  return (
    <ol className={"plan-card__tiles" + (n > TILE_COLUMNS ? " is-compact" : "")} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {items.map((x) => (
        <li key={x.key} className="plan-card__cell" title={x.title}>
          <span className={"momentum__tile" + (x.state === "done" ? " is-done" : x.state === "next" ? " is-next" : "")}>{x.icon}</span>
          {x.label != null && <span className="sr-only">{x.label}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Bars by day or by session: the visual for a week's volume. */
export function CardBars({ values, labels, highlight, height = 46 }: { values: number[]; labels?: string[]; highlight?: number; height?: number }) {
  const max = Math.max(1, ...values);
  return (
    <ol className="card-bars" style={{ ["--h" as string]: `${height}px` }} aria-hidden>
      {values.map((v, i) => (
        <li key={i} className={i === highlight ? "is-hi" : v ? "is-on" : undefined}>
          <span className="card-bars__track">
            <span className="card-bars__bar" style={{ blockSize: v ? `${Math.max(8, (v / max) * 100)}%` : 4 }} />
          </span>
          {labels && <span className="card-bars__label">{labels[i]}</span>}
        </li>
      ))}
    </ol>
  );
}

/** A thin meter: how far along. */
export function CardMeter({ value, accent }: { value: number; accent?: boolean }) {
  return (
    <span className={"card-meter" + (accent ? " is-accent" : "")} aria-hidden>
      <span style={{ inlineSize: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </span>
  );
}
