import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { accountContext } from "../lib/account-context";
import { resetDb, updateClub } from "../lib/db";
import { createAgentKey, listAgentKeys, revokeAgentKey } from "../lib/agent-keys";
import { POST as mcp, GET as mcpGet } from "../app/api/mcp/route";

const origin = "http://localhost:3000";

test("MCP endpoint exposes the nine treasurer tools behind per-account agent keys", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "rotapot-mcp-"));
  Object.assign(process.env, {
    BETTER_AUTH_URL: origin,
    ACCOUNT_DATA_DIR: path.join(directory, "accounts"),
    AGENT_KEYS_PATH: path.join(directory, "agent-keys.json"),
  });
  const alice = { id: "acct-alice", name: "Alice", email: "alice@example.com" };
  const bob = { id: "acct-bob", name: "Bob", email: "bob@example.com" };
  accountContext.run(alice, () => { resetDb(); });
  accountContext.run(bob, () => { updateClub(resetDb().clubs[0].id, (c) => { c.name = "Bob's Private Circle"; }); });

  const a = createAgentKey(alice, "test");
  const b = createAgentKey(bob, "test");
  assert.match(a.token, /^rtp_/);
  assert.equal(JSON.stringify(listAgentKeys(alice.id)).includes(a.token), false, "list never exposes secrets");
  assert.equal(listAgentKeys(alice.id).length, 1);

  const call = (token: string | null, body: unknown, extra: Record<string, string> = {}) =>
    mcp(new Request(`${origin}/api/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
      body: JSON.stringify(body),
    }));
  const rpc = (id: number, method: string, params?: unknown) => ({ jsonrpc: "2.0", id, method, params });

  assert.equal((await call(null, rpc(1, "ping"))).status, 401);
  const bad = await call("rtp_nope", rpc(1, "ping"));
  assert.equal(bad.status, 401);
  assert.match(bad.headers.get("www-authenticate")!, /Bearer/);
  assert.equal((await call(a.token, rpc(1, "ping"), { Origin: "https://evil.example" })).status, 403);
  assert.equal((await mcpGet()).status, 405);

  const init = await (await call(a.token, rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } }))).json();
  assert.equal(init.result.serverInfo.name, "rotapot");
  assert.deepEqual(init.result.capabilities, { tools: {} });
  assert.equal((await call(a.token, { jsonrpc: "2.0", method: "notifications/initialized" })).status, 202);

  const list = await (await call(a.token, rpc(2, "tools/list"))).json();
  assert.equal(list.result.tools.length, 9);
  assert.ok(list.result.tools.every((t: { inputSchema: unknown }) => t.inputSchema));
  assert.equal(list.result.tools.some((t: { name: string }) => /release|approve/.test(t.name)), false, "no tool releases money");

  const names = async (token: string) => {
    const res = await (await call(token, rpc(3, "tools/call", { name: "list_circles", arguments: {} }))).json();
    assert.notEqual(res.result.isError, true);
    return JSON.stringify(JSON.parse(res.result.content[0].text));
  };
  const aliceView = await names(a.token);
  assert.match(aliceView, /Ubuntu Circle/);
  assert.equal(aliceView.includes("Bob's Private Circle"), false);
  assert.match(await names(b.token), /Bob's Private Circle/);

  const unknown = await (await call(a.token, rpc(4, "tools/call", { name: "release_payout", arguments: {} }))).json();
  assert.equal(unknown.error.code, -32602);
  const failing = await (await call(a.token, rpc(5, "tools/call", { name: "get_circle", arguments: { club_id: "nope" } }))).json();
  assert.equal(failing.result.isError, true);
  assert.equal((await (await call(a.token, rpc(6, "nothing"))).json()).error.code, -32601);

  const id = listAgentKeys(alice.id)[0].id;
  assert.equal(revokeAgentKey(bob.id, id), false, "another account cannot revoke");
  assert.equal(revokeAgentKey(alice.id, id), true);
  assert.equal((await call(a.token, rpc(7, "tools/list"))).status, 401);
  assert.equal((await call(b.token, rpc(8, "tools/list"))).status, 200);
});
