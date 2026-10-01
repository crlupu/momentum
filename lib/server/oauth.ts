/**
 * Just enough OAuth for Claude's connector "Connect" button, which expects
 * to sign in to a server before using it.
 *
 * The connector's real key is the token in its URL (/api/mcp/<token>);
 * sign-in adds nothing to that, so it approves itself when the request
 * names that URL (Claude sends it as `resource`) and otherwise asks for the
 * token once. Codes and tokens are signed with the connector token, so
 * nothing needs storing, and changing the token signs everyone out.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const secret = () => process.env.CONNECTOR_TOKEN ?? "";

export function tokenOk(token: string | null | undefined): boolean {
  const want = secret();
  if (!token || want.length < 24) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The token in a connector URL, if the URL is one: …/api/mcp/<token>. */
export function tokenIn(url: string | null | undefined): string | null {
  const m = url?.match(/\/api\/mcp\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const b64 = (s: Buffer | string) => Buffer.from(s).toString("base64url");
const mac = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function sign(payload: Record<string, unknown>): string {
  const body = b64(JSON.stringify(payload));
  return `${body}.${mac(body)}`;
}

export function verify<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig || mac(body) !== sig) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp?: number };
    return p.exp && p.exp < Date.now() ? null : p;
  } catch {
    return null;
  }
}

export const s256 = (verifier: string) => b64(createHash("sha256").update(verifier).digest());

export function origin(req: Request): string {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? u.host;
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
