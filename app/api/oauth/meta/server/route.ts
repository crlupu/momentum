/** OAuth authorization server metadata (RFC 8414), at /.well-known/oauth-authorization-server. */
import { json, origin } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const o = origin(req);
  return json({
    issuer: o,
    authorization_endpoint: `${o}/api/oauth/authorize`,
    token_endpoint: `${o}/api/oauth/token`,
    registration_endpoint: `${o}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["momentum"],
  });
}
