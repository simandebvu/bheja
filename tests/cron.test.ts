import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { accountContext } from "../lib/account-context";
import { loadDb, saveDb, seedDb } from "../lib/db";
import { runScheduledBriefings, type CronAccount } from "../lib/scheduled-briefing";
import { POST } from "../app/api/cron/briefing/route";

process.env.ACCOUNT_DATA_DIR = path.join(mkdtempSync(path.join(tmpdir(), "rotapot-cron-")), "accounts");
process.env.BETTER_AUTH_URL = "http://localhost:3000";
const origin = "http://localhost:3000";

const call = (auth?: string) => POST(new Request(`${origin}/api/cron/briefing`, { method: "POST", headers: auth ? { Authorization: auth } : {} }));
const as = <T>(a: CronAccount, fn: () => T) => accountContext.run(a, fn);
const account = (id: string): CronAccount => ({ id, name: id, email: `${id}@example.com` });
const runner = (calls: string[]) => async () => {
  calls.push("run");
  return { reply: "All calm.", actions: [] };
};

function setup(a: CronAccount, kind: "launched" | "draft" | "sample" | "empty", lastBriefing?: string) {
  as(a, () => {
    const db = loadDb();
    const base = { ...seedDb().clubs[0] };
    if (kind === "launched") { delete base.sample; db.clubs = [{ ...base, status: "active" }]; }
    if (kind === "draft") { delete base.sample; db.clubs = [{ ...base, status: "draft" }]; }
    if (kind === "sample") db.clubs = [{ ...base, sample: true }];
    if (lastBriefing) db.briefing = { at: lastBriefing, reply: "old", steps: [], source: "manual" };
    saveDb(db);
  });
}

test("cron endpoint: 503 without a secret, 401 for a wrong or missing bearer", async () => {
  delete process.env.CRON_SECRET;
  assert.equal((await call("Bearer anything")).status, 503);
  process.env.CRON_SECRET = "s3cret-value";
  assert.equal((await call()).status, 401);
  assert.equal((await call("Bearer wrong")).status, 401);
  assert.equal((await call("s3cret-value")).status, 401);
});

test("scheduled briefings run only for launched circles, respect CRON_MIN_HOURS, and survive failures", async () => {
  const launched = account("launched"), fresh = account("fresh"), stale = account("stale"), broken = account("broken"), after = account("after");
  const draft = account("draft"), sample = account("sample"), empty = account("empty");
  const now = new Date("2026-11-10T05:00:00Z");
  setup(launched, "launched"); setup(draft, "draft"); setup(sample, "sample"); setup(empty, "empty");
  setup(fresh, "launched", "2026-11-10T01:00:00Z"); // 4h old: skipped
  setup(stale, "launched", "2026-11-09T01:00:00Z"); // 28h old: runs
  setup(broken, "launched"); setup(after, "launched");
  const accounts = [draft, sample, empty, fresh, broken, launched, stale, after];
  delete process.env.CRON_MAX_ACCOUNTS; delete process.env.CRON_MIN_HOURS;

  const ran: string[] = [];
  const result = await runScheduledBriefings({
    origin, now, listAccounts: async () => accounts,
    runner: async () => {
      const id = (await import("../lib/account-context")).currentAccount().id;
      if (id === "broken") throw new Error("model exploded");
      ran.push(id);
      return { reply: "ok", actions: [{ tool: "get_overview", input: {}, ok: true, summary: "looked" }] };
    },
  });
  assert.deepEqual(result, { ran: 3, skipped: 4, failed: 1 });
  assert.deepEqual(ran, ["launched", "stale", "after"]);
  assert.equal(as(launched, () => loadDb().briefing?.source), "scheduled");
  assert.equal(as(fresh, () => loadDb().briefing?.reply), "old");
  assert.equal(as(broken, () => loadDb().briefing), undefined);

  // A second pass is free apart from the account that failed.
  const calls: string[] = [];
  const again = await runScheduledBriefings({ origin, now: new Date("2026-11-10T06:00:00Z"), listAccounts: async () => accounts, runner: runner(calls) });
  assert.deepEqual(again, { ran: 1, skipped: 7, failed: 0 });
  assert.equal(calls.length, 1);

  // CRON_MIN_HOURS=1 lets a 4h-old briefing run again.
  process.env.CRON_MIN_HOURS = "1";
  const hourly: string[] = [];
  const short = await runScheduledBriefings({ origin, now, listAccounts: async () => [fresh], runner: runner(hourly) });
  assert.deepEqual(short, { ran: 1, skipped: 0, failed: 0 });
  delete process.env.CRON_MIN_HOURS;

  // CRON_MAX_ACCOUNTS caps the work.
  const olds = ["o1", "o2", "o3"].map(account);
  olds.forEach((a) => setup(a, "launched", "2026-01-01T00:00:00Z"));
  process.env.CRON_MAX_ACCOUNTS = "2";
  const capped: string[] = [];
  const third = await runScheduledBriefings({ origin, now, listAccounts: async () => olds, runner: runner(capped) });
  assert.deepEqual(third, { ran: 2, skipped: 0, failed: 0 });
  delete process.env.CRON_MAX_ACCOUNTS;
});
