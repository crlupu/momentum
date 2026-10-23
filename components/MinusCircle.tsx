/**
 * iOS's delete mark: a white minus on a red disc, as a list in Edit shows
 * at the start of each row. Every icon-only delete in the app uses it.
 */
export function MinusCircle({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 22 22" width={size} height={size} aria-hidden className="minus-circle">
      <circle cx="11" cy="11" r="10" fill="var(--ios-red, #ff3b30)" />
      <path d="M6.5 11h9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
