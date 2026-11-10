import { accountContext } from "@/lib/account-context";
import { agentTools, executeTool } from "@/lib/agent";
import { verifyAgentKey } from "@/lib/agent-keys";
import { baseUrl } from "@/lib/http";
import pkg from "../../../package.json";

export const dynamic = "force-dynamic";

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

const rpcError = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const unauthorized = () => Response.json({ error: "A valid Rotapot agent key is required." }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="rotapot"' } });

async function dispatch(msg: Rpc, req: Request): Promise<object | null> {
  const isNotification = msg.id === undefined;
  if (msg?.jsonrpc !== "2.0" || typeof msg.method !== "string") return rpcError(msg?.id, -32600, "Invalid Request");
  const params = msg.params ?? {};
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id, result });
  switch (msg.method) {
    case "initialize":
      return ok({
        protocolVersion: typeof params.protocolVersion === "string" ? params.protocolVersion : "2025-06-18",
        serverInfo: { name: "rotapot", version: pkg.version },
        capabilities: { tools: {} },
        instructions: "Rotapot treasurer tools. Agents can propose payouts and payment plans; only the treasurer releases money in the app.",
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: agentTools().map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema })) });
    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string" || !agentTools().some((t) => t.name === name)) return rpcError(msg.id, -32602, `Unknown tool "${String(name)}"`);
      try {
        const input = (params.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Record<string, unknown>;
        const { result } = await executeTool(name, input, baseUrl(req));
        return ok({ content: [{ type: "text", text: JSON.stringify(result) }] });
      } catch (error) {
        return ok({ content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], isError: true });
      }
    }
    default:
      if (isNotification || msg.method.startsWith("notifications/")) return null;
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(process.env.BETTER_AUTH_URL!).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  const key = bearer ? verifyAgentKey(bearer) : null;
  if (!key) return unauthorized();
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json(rpcError(null, -32700, "Parse error"), { status: 400 }); }
  const account = { id: key.accountId, name: key.name, email: key.email };
  return accountContext.run(account, async () => {
    if (Array.isArray(body)) {
      if (!body.length) return Response.json(rpcError(null, -32600, "Invalid Request"), { status: 400 });
      const out = (await Promise.all(body.map((m) => dispatch(m as Rpc, req)))).filter(Boolean);
      return out.length ? Response.json(out) : new Response(null, { status: 202 });
    }
    const out = await dispatch(body as Rpc, req);
    return out ? Response.json(out) : new Response(null, { status: 202 });
  });
}

const notAllowed = () => new Response(null, { status: 405, headers: { Allow: "POST" } });
export const GET = notAllowed;
export const DELETE = notAllowed;
