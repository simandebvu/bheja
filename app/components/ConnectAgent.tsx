"use client";

import { useCallback, useEffect, useState } from "react";

type Key = { id: string; label: string; createdAt: string; lastUsedAt: string | null };

export default function ConnectAgent() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-keys", { cache: "no-store" });
      if (res.ok) setKeys((await res.json()).keys);
    } catch { /* leave list as is */ }
  }, []);

  useEffect(() => { setOrigin(window.location.origin); void load(); }, [load]);

  async function create() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/agent-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
      if (!res.ok) throw new Error();
      setFresh((await res.json()).token); setLabel("");
      await load();
    } catch { setError("Could not create a key. Please try again."); }
    finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setError(null);
    const res = await fetch(`/api/agent-keys/${id}`, { method: "DELETE" });
    if (!res.ok) { setError("Could not revoke that key."); return; }
    await load();
  }

  async function copy(what: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 1500); }
    catch { setError("Copy failed. Select the text and copy it manually."); }
  }

  const snippet = JSON.stringify({ mcpServers: { rotapot: { type: "http", url: `${origin}/api/mcp`, headers: { Authorization: `Bearer ${fresh ?? "<your key>"}` } } } }, null, 2);

  return (
    <details className="connect-details">
    <summary>For developers: connect your own AI agent</summary>
    <section className="connect-agent" aria-label="Connect an agent">
      <div>
        <span className="eyebrow">Agent-first</span>
        <h3>Connect an agent</h3>
        <p>Let any MCP client run your circles: check who has paid, send reminders, draft payouts and payment plans. Agents can propose, but never release money. Only you do that, in the app.</p>
      </div>
      <div className="connect-body">
        <div className="connect-new">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Key name (optional)" maxLength={60} aria-label="Key name" />
          <button className="secondary-action" disabled={busy} onClick={() => void create()}>{busy ? "Creating…" : "Create key"}</button>
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        {fresh && <div className="connect-fresh"><span className="field-help">Copy this key now. It will not be shown again.</span><code>{fresh}</code><button className="ghost-btn" onClick={() => void copy("key", fresh)}>{copied === "key" ? "Copied" : "Copy key"}</button></div>}
        {keys.length > 0 && <ul className="connect-keys">{keys.map((k) => <li key={k.id}><span><b>{k.label}</b> <i>created {k.createdAt.slice(0, 10)}{k.lastUsedAt ? ` · last used ${k.lastUsedAt.slice(0, 10)}` : " · never used"}</i></span><button className="link-btn" onClick={() => void revoke(k.id)}>Revoke</button></li>)}</ul>}
        <div className="connect-config">
          <span className="field-help">Client config for any MCP client that supports streamable HTTP.</span>
          <pre>{snippet}</pre>
          <button className="ghost-btn" onClick={() => void copy("config", snippet)}>{copied === "config" ? "Copied" : "Copy config"}</button>
        </div>
      </div>
    </section>
    </details>
  );
}
