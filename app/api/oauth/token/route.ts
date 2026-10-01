/** Token endpoint: exchanges a code (with its PKCE verifier) or a refresh token. */
import { json, s256, sign, verify } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";

const YEAR = 365 * 24 * 3600_000;

function tokens() {
  return json({
    access_token: sign({ t: "access", exp: Date.now() + YEAR }),
    token_type: "Bearer",
    expires_in: YEAR / 1000,
    refresh_token: sign({ t: "refresh" }),
    scope: "momentum",
  });
}

export async function POST(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  const p = type.includes("json")
    ? new URLSearchParams(Object.entries((await req.json()) as Record<string, string>))
    : new URLSearchParams(await req.text());
  const grant = p.get("grant_type");

  if (grant === "authorization_code") {
    const code = verify<{ t: string; cc: string; ru: string }>(p.get("code"));
    const verifier = p.get("code_verifier");
    if (!code || code.t !== "code" || !verifier || s256(verifier) !== code.cc)
      return json({ error: "invalid_grant" }, 400);
    if (p.get("redirect_uri") && p.get("redirect_uri") !== code.ru) return json({ error: "invalid_grant" }, 400);
    return tokens();
  }
  if (grant === "refresh_token") {
    const r = verify<{ t: string }>(p.get("refresh_token"));
    if (!r || r.t !== "refresh") return json({ error: "invalid_grant" }, 400);
    return tokens();
  }
  return json({ error: "unsupported_grant_type" }, 400);
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST" },
  });
}
