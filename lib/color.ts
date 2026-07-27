/** Relative luminance per WCAG 2.1. */
function luminance(hex: string): number {
  const m = hex.replace("#", "").match(/../g);
  if (!m) return 0;
  const [r, g, b] = m.map((h) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = "#ffffff";
const INK = "#101214";

/**
 * Picks the more legible text colour for a given background.
 *
 * White is preferred when it comfortably passes WCAG AA (4.5:1) — it suits
 * saturated, darker fills and matches the usual convention for buttons — but
 * light fills such as the brand yellow fall back to near-black, where white
 * would be effectively invisible (1.3:1).
 */
export function readableText(background: string): string {
  const onWhite = contrast(WHITE, background);
  const onInk = contrast(INK, background);
  if (onWhite >= 4.5) return WHITE;
  return onInk >= onWhite ? INK : WHITE;
}
