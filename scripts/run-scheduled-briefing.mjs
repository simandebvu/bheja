#!/usr/bin/env node
// Calls the scheduled-briefing endpoint. Env: CRON_SECRET (required), ROTAPOT_URL (default http://127.0.0.1:3096).
const base = process.env.ROTAPOT_URL || "http://127.0.0.1:3096";
if (!process.env.CRON_SECRET) { console.error("CRON_SECRET is not set."); process.exit(1); }
const res = await fetch(`${base}/api/cron/briefing`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
console.log(res.status, await res.text());
process.exit(res.ok ? 0 : 1);
