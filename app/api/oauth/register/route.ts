/** Dynamic client registration (RFC 7591): any client may register; approval needs the token. */
import { randomUUID } from "node:crypto";
import { json } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const meta = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return json(
    {
      ...meta,
      client_id: `momentum-${randomUUID()}`,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    201
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST" },
  });
}
