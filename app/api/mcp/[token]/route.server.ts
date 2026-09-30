/**
 * The Claude connector: an MCP server over Streamable HTTP, for adding to
 * Claude as a custom connector at https://<deployment>/api/mcp/<token>.
 *
 * Built only on Vercel (MOMENTUM_CONNECTOR=1, see next.config.mjs); the
 * GitHub Pages build is a static export and leaves it out. The token in the
 * path is the key: anyone with the full URL can edit the data, so it is long,
 * random, and compared in constant time. Stateless: each request gets its
 * own server, as serverless functions don't keep one between calls.
 */
import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerTools } from "@/lib/server/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function allowed(token: string): boolean {
  const want = process.env.CONNECTOR_TOKEN ?? "";
  if (want.length < 24) return false; // unset or too short to be a key
  const a = Buffer.from(token);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  if (!allowed(token)) return new Response("Not found", { status: 404 });

  const server = new McpServer({ name: "momentum", version: "1.0.0" });
  registerTools(server);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
