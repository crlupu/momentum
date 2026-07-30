#!/usr/bin/env python3
"""Palette audit and Carbon token generator.

The app is restricted to the official palette: seven hue families of ten steps, plus neutrals. Source greps can't prove that:
Carbon components paint from their own --cds-* tokens, so a Toggle drew
Carbon's #42be65 and a label drew its #c6c6c6 even though neither appeared
anywhere in this repo. This walks the rendered DOM instead and checks every
computed colour that actually paints.

  python3 scripts/palette-audit.py verify <url>
  python3 scripts/palette-audit.py generate      # rewrite the --cds-* overrides

`generate` reads the compiled CSS in out/ and pins every Carbon theme token to
its nearest palette colour, per theme. Run a production build first.

Requires: pip install playwright && python3 -m playwright install chromium
"""
import glob, pathlib, re, sys

PALETTE = {
    "--c-blue-10": "#edf4fc",
    "--c-blue-100": "#05103e",
    "--c-blue-20": "#ccddfb",
    "--c-blue-30": "#9dc0f8",
    "--c-blue-40": "#79a3f5",
    "--c-blue-50": "#5489f3",
    "--c-blue-60": "#2860f3",
    "--c-blue-70": "#1e48d2",
    "--c-blue-80": "#1330a5",
    "--c-blue-90": "#091970",
    "--c-cyan-10": "#e4f5fc",
    "--c-cyan-100": "#0c192a",
    "--c-cyan-20": "#bce5f9",
    "--c-cyan-30": "#84c8f9",
    "--c-cyan-40": "#59aff8",
    "--c-cyan-50": "#4491e1",
    "--c-cyan-60": "#3271be",
    "--c-cyan-70": "#25579c",
    "--c-cyan-80": "#173d6e",
    "--c-cyan-90": "#0e2a4f",
    "--c-green-10": "#defae3",
    "--c-green-100": "#0d1b0a",
    "--c-green-20": "#adecb7",
    "--c-green-30": "#7ad381",
    "--c-green-40": "#65b96b",
    "--c-green-50": "#4e9f52",
    "--c-green-60": "#3c7e40",
    "--c-green-70": "#2d6130",
    "--c-green-80": "#1d471f",
    "--c-green-90": "#133115",
    "--c-magenta-10": "#fcf1f7",
    "--c-magenta-100": "#250b16",
    "--c-magenta-20": "#f6d2de",
    "--c-magenta-30": "#f1a5c1",
    "--c-magenta-40": "#e87ea2",
    "--c-magenta-50": "#dc5f89",
    "--c-magenta-60": "#be3964",
    "--c-magenta-70": "#95294d",
    "--c-magenta-80": "#691838",
    "--c-magenta-90": "#4e0b2a",
    "--c-purple-10": "#f7effa",
    "--c-purple-100": "#1b1030",
    "--c-purple-20": "#e2d6fa",
    "--c-purple-30": "#cbb1fa",
    "--c-purple-40": "#b48ff8",
    "--c-purple-50": "#a173f7",
    "--c-purple-60": "#8044f4",
    "--c-purple-70": "#6534c3",
    "--c-purple-80": "#492390",
    "--c-purple-90": "#331668",
    "--c-red-10": "#fcf1ef",
    "--c-red-100": "#280a0a",
    "--c-red-20": "#f3d3d4",
    "--c-red-30": "#f2a7ab",
    "--c-red-40": "#ed7f7e",
    "--c-red-50": "#e95958",
    "--c-red-60": "#cd3b3b",
    "--c-red-70": "#952825",
    "--c-red-80": "#6b1a17",
    "--c-red-90": "#470c0e",
    "--c-teal-10": "#e0f8f8",
    "--c-teal-100": "#0a191c",
    "--c-teal-20": "#9febeb",
    "--c-teal-30": "#64d1ce",
    "--c-teal-40": "#53b5b4",
    "--c-teal-50": "#469c9b",
    "--c-teal-60": "#357a77",
    "--c-teal-70": "#28605f",
    "--c-teal-80": "#1b4448",
    "--c-teal-90": "#102f34",
    "--ibm-black": "#000000",
    "--ibm-cool-gray-100": "#121619",
    "--ibm-cool-gray-80": "#343a3f",
    "--ibm-cool-gray-40": "#a2a9b0",
    "--ibm-cool-gray-20": "#dde1e6",
    "--ibm-cool-gray-10": "#f2f4f8",
    "--ibm-white": "#ffffff",
}
VAR = {v: k for k, v in PALETTE.items()}

# Google's four brand colours in the sign-in button are deliberately exempt:
# their brand guidelines require the exact values, and recolouring them would
# make a third-party button look counterfeit.
GOOGLE = {(66, 133, 244), (52, 168, 83), (251, 188, 5), (234, 67, 53)}


def rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


RGB_PALETTE = {rgb(h) for h in PALETTE.values()}

PROPS = """['color','backgroundColor','borderTopColor','borderBottomColor',
 'borderLeftColor','borderRightColor','fill','stroke','outlineColor',
 'caretColor','textDecorationColor']"""

SCAN = """() => {
  const props = %s;
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    for (const p of props) {
      const v = cs[p];
      if (!v || v === 'none') continue;
      const m = v.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
      if (!m) continue;
      // Fully transparent paints nothing, so it can't be off-palette.
      const a = m[4] === undefined ? 1 : parseFloat(m[4]);
      if (a === 0) continue;
      out.push([+m[1], +m[2], +m[3], p, (el.className || '').toString().slice(0, 44)]);
    }
  }
  return out;
}""" % PROPS


def verify(url):
    from playwright.sync_api import sync_playwright
    failed = False
    with sync_playwright() as p:
        b = p.chromium.launch()
        for theme in ("dark", "light"):
            pg = b.new_page(viewport={"width": 900, "height": 1000})
            pg.goto(url, wait_until="load")
            pg.evaluate(f"document.documentElement.className='{theme}'")
            pg.wait_for_timeout(700)
            rows = pg.evaluate(SCAN)
            bad = {}
            for r, g, bl, prop, cls in rows:
                c = (r, g, bl)
                if c in RGB_PALETTE or c in GOOGLE:
                    continue
                bad[(c, prop, cls)] = bad.get((c, prop, cls), 0) + 1
            print(f"{theme}: {len(rows)} painted colour declarations")
            if bad:
                failed = True
                for (c, prop, cls), n in sorted(bad.items()):
                    print(f"  OFF-PALETTE rgb{c} via {prop} on '{cls}' x{n}")
            else:
                print("  ok — every painted colour is in the palette")
            pg.close()
        b.close()
    return 1 if failed else 0


def nearest(c):
    """Nearest palette colour. Green is weighted up because it dominates
    perceived lightness, which is what matters most when substituting."""
    return min(PALETTE.values(),
               key=lambda h: (lambda p: 2 * (c[0] - p[0]) ** 2
                              + 4 * (c[1] - p[1]) ** 2
                              + 3 * (c[2] - p[2]) ** 2)(rgb(h)))


def parse(v):
    v = v.strip().lower()
    m = re.match(r"#([0-9a-f]{3,8})$", v)
    if m:
        h = m.group(1)
        if len(h) == 8:
            return rgb("#" + h[:6]), int(h[6:], 16) / 255
        if len(h) == 4:
            return rgb("#" + h[:3]), int(h[3] * 2, 16) / 255
        return rgb("#" + h), 1.0
    m = re.match(r"rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$", v)
    if m:
        a = float(m.group(4)) if m.group(4) is not None else 1.0
        return tuple(int(float(m.group(i))) for i in (1, 2, 3)), a
    return None, None


MARKER = "/* ============================================================\n   Carbon theme tokens, remapped onto the palette."


def generate():
    files = glob.glob("out/_next/static/css/*.css")
    if not files:
        sys.exit("No compiled CSS in out/. Run `npm run build` first.")
    css = "".join(pathlib.Path(f).read_text() for f in files)

    blocks = []
    for sel in ("html.light", "html.dark"):
        # Every occurrence, not the first: this script's own generated block
        # uses the same selectors, and its values are var() references. Reading
        # only the first match found that block, parsed nothing out of it, and
        # silently wiped the overrides. Literal colours only.
        toks = {}
        for m in re.finditer(re.escape(sel) + r"\s*\{", css):
            block = css[m.end():css.index("}", m.end())]
            for name, val in re.findall(r"(--cds-[a-z0-9-]+):\s*([^;}]+)", block):
                c, a = parse(val)
                if c is None or a == 0:
                    continue
                toks[name] = nearest(c)
        if not toks:
            sys.exit(f"Found no literal Carbon colours for {sel}. Build first, "
                     f"and make sure the build predates these overrides.")
        blocks.append((sel, toks))
        print(f"{sel}: {len(toks)} tokens")

    body = [MARKER + """
   GENERATED by scripts/palette-audit.py — do not hand-edit. Carbon
   components paint from their own --cds-* tokens rather than this app's, so
   restricting the app's tokens is not enough on its own. Each token below is
   pinned to whichever palette colour sits nearest it, per theme. Unlayered,
   so it beats the carbon layer.
   ============================================================ */
"""]
    for sel, toks in blocks:
        body.append(sel + " {")
        body += [f"  {n}: var({VAR[toks[n]]});" for n in sorted(toks)]
        body.append("}\n")

    p = pathlib.Path("app/globals.css")
    cur = p.read_text()
    if MARKER in cur:
        cur = cur[:cur.index(MARKER)]
    p.write_text(cur.rstrip("\n") + "\n\n" + "\n".join(body))
    print("app/globals.css updated")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "verify" and len(sys.argv) > 2:
        sys.exit(verify(sys.argv[2]))
    if cmd == "generate":
        generate()
    else:
        sys.exit(__doc__)
