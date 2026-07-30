#!/usr/bin/env python3
"""Palette audit and Carbon token generator.

The app is restricted to thirteen IBM colours. Source greps can't prove that:
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
    "--ibm-black": "#000000",
    "--ibm-cool-gray-100": "#121619",
    "--ibm-cool-gray-80": "#343a3f",
    "--ibm-cool-gray-40": "#a2a9b0",
    "--ibm-cool-gray-20": "#dde1e6",
    "--ibm-cool-gray-10": "#f2f4f8",
    "--ibm-white": "#ffffff",
    "--ibm-purple-80": "#491d8b",
    "--ibm-purple-60": "#8a3ffc",
    "--ibm-blue-60": "#0f62fe",
    "--ibm-cyan-40": "#33b1ff",
    "--ibm-red-40": "#ff8389",
    "--ibm-green-20": "#a7f0ba",
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
                print("  ok — every painted colour is one of the thirteen")
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
