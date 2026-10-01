/** Protected resource metadata (RFC 9728), at /.well-known/oauth-protected-resource[/<path>]. */
import { json, origin } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const o = origin(req);
  // The path after /.well-known/oauth-protected-resource: the connector URL
  // this metadata describes. (The request keeps its original address
  // through the rewrite.)
  const u = new URL(req.url);
  const path =
    u.pathname.match(/^\/\.well-known\/oauth-protected-resource\/(.+)$/)?.[1] ?? u.searchParams.get("p");
  return json({
    resource: path ? `${o}/${path}` : `${o}/api/mcp`,
    authorization_servers: [o],
    bearer_methods_supported: ["header"],
    scopes_supported: ["momentum"],
  });
}
