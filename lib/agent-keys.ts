import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const KEY_PREFIX = "rtp_";

export type AgentKeyRecord = {
  id: string;
  accountId: string;
  name: string;
  email?: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type Store = Record<string, AgentKeyRecord>; // sha256(token) -> record

const storePath = () => process.env.AGENT_KEYS_PATH || path.join(process.cwd(), "data", "agent-keys.json");
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

function read(): Store {
  try { return JSON.parse(fs.readFileSync(storePath(), "utf8")) as Store; } catch { return {}; }
}

function write(store: Store) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function createAgentKey(account: { id: string; name: string; email?: string }, label: string) {
  const token = `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  const record: AgentKeyRecord = {
    id: randomUUID(), accountId: account.id, name: account.name, email: account.email,
    label: label.trim().slice(0, 60) || "Agent key", createdAt: new Date().toISOString(), lastUsedAt: null,
  };
  const store = read();
  store[hash(token)] = record;
  write(store);
  return { token, key: record };
}

export function listAgentKeys(accountId: string) {
  return Object.values(read()).filter((k) => k.accountId === accountId)
    .map(({ id, label, createdAt, lastUsedAt }) => ({ id, label, createdAt, lastUsedAt }));
}

export function revokeAgentKey(accountId: string, id: string): boolean {
  const store = read();
  const entry = Object.entries(store).find(([, k]) => k.id === id && k.accountId === accountId);
  if (!entry) return false;
  delete store[entry[0]];
  write(store);
  return true;
}

export function verifyAgentKey(token: string): AgentKeyRecord | null {
  if (!token.startsWith(KEY_PREFIX)) return null;
  const store = read();
  const record = store[hash(token)];
  if (!record) return null;
  const last = record.lastUsedAt ? Date.parse(record.lastUsedAt) : 0;
  if (Date.now() - last > 60_000) {
    record.lastUsedAt = new Date().toISOString();
    write(store);
  }
  return record;
}
