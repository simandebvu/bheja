import Database from "better-sqlite3";
import path from "node:path";
import { accountContext } from "./account-context";
import { BRIEFING_PROMPT, runAgent } from "./agent";
import { getAuth } from "./auth";
import { loadDb, updateDb } from "./db";

export type CronAccount = { id: string; name: string; email?: string };
export type BriefingRunner = (origin: string) => Promise<{ reply: string; actions: { tool: string; input: Record<string, unknown>; ok: boolean; summary: string }[] }>;
export type Summary = { ran: number; skipped: number; failed: number };

const defaultRunner: BriefingRunner = (origin) => runAgent([{ role: "user", content: BRIEFING_PROMPT }], origin);

function positive(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Verified accounts, read straight from the Better Auth SQLite file. */
export async function listVerifiedAccounts(): Promise<CronAccount[]> {
  await getAuth(); // ensures the schema exists
  const db = new Database(process.env.AUTH_DB_PATH || path.join(process.cwd(), "data", "auth.sqlite"), { readonly: true });
  try {
    return db.prepare("select id, name, email from user where emailVerified = 1 order by createdAt").all() as CronAccount[];
  } finally { db.close(); }
}

/**
 * Run the treasurer briefing for each verified account with a launched circle.
 * Sequential, capped, and conservative: recent briefings are skipped.
 * The agent has no release tool, so this can never move money.
 */
export async function runScheduledBriefings(opts: {
  origin: string;
  now?: Date;
  listAccounts?: () => Promise<CronAccount[]>;
  runner?: BriefingRunner;
}): Promise<Summary> {
  const now = opts.now ?? new Date();
  const max = Math.floor(positive(process.env.CRON_MAX_ACCOUNTS, 25));
  const minMs = positive(process.env.CRON_MIN_HOURS, 20) * 3_600_000;
  const runner = opts.runner ?? defaultRunner;
  const accounts = await (opts.listAccounts ?? listVerifiedAccounts)();
  const summary: Summary = { ran: 0, skipped: 0, failed: 0 };
  for (const account of accounts) {
    if (summary.ran + summary.failed >= max) break;
    try {
      await accountContext.run(account, async () => {
        const db = loadDb();
        if (!db.clubs.some((c) => !c.sample && c.status !== "draft")) { summary.skipped++; return; }
        const last = db.briefing ? Date.parse(db.briefing.at) : NaN;
        if (Number.isFinite(last) && now.getTime() - last < minMs) { summary.skipped++; return; }
        const result = await runner(opts.origin);
        updateDb((d) => { d.briefing = { at: new Date().toISOString(), reply: result.reply, steps: result.actions, source: "scheduled" }; });
        summary.ran++;
      });
    } catch (err) {
      summary.failed++;
      console.error("[rotapot] scheduled briefing failed for an account:", err instanceof Error ? err.message : err);
    }
  }
  return summary;
}
