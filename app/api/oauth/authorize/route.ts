/**
 * The sign-in step. Approved at once when the request names the connector
 * URL with its token (Claude sends it as `resource`); otherwise a one-field
 * page asks for the token.
 */
import { sign, tokenIn, tokenOk } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function approve(p: URLSearchParams): Response {
  const redirect = p.get("redirect_uri");
  const challenge = p.get("code_challenge");
  if (!redirect || !challenge) return new Response("Missing redirect_uri or code_challenge", { status: 400 });
  const code = sign({ t: "code", cc: challenge, ru: redirect, exp: Date.now() + 10 * 60_000 });
  const to = new URL(redirect);
  to.searchParams.set("code", code);
  const state = p.get("state");
  if (state) to.searchParams.set("state", state);
  return Response.redirect(to.toString(), 302);
}

function page(p: URLSearchParams, wrong: boolean): Response {
  const hidden = [...p.entries()]
    .filter(([k]) => k !== "token")
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Momentum</title>
<style>body{font:17px -apple-system,system-ui,sans-serif;max-width:24rem;margin:15vh auto;padding:0 1rem;color:#1d1d1f}input[type=password]{width:100%;font:inherit;padding:.7rem;border:1px solid #ccc;border-radius:10px;box-sizing:border-box}button{margin-top:.75rem;width:100%;font:inherit;font-weight:600;padding:.75rem;border:0;border-radius:10px;background:#097cfb;color:#fff}p{color:#6b6e6c}@media(prefers-color-scheme:dark){body{background:#000;color:#fff}input[type=password]{background:#1c1c1e;color:#fff;border-color:#38393a}}</style>
<h1>Connect Momentum</h1><p>Enter your connector token (CONNECTOR_TOKEN in Vercel).</p>
<form method="post">${hidden}<input type="password" name="token" autofocus required placeholder="Token">${wrong ? '<p style="color:#d1242f">That token is not right.</p>' : ""}<button>Connect</button></form>`;
  return new Response(html, { status: wrong ? 401 : 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

export function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  return tokenOk(tokenIn(p.get("resource"))) ? approve(p) : page(p, false);
}

export async function POST(req: Request) {
  const p = new URLSearchParams(await req.text());
  return tokenOk(p.get("token")) ? approve(p) : page(p, true);
}
