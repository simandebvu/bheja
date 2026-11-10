import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { baseUrl } from "@/lib/http";
import { runScheduledBriefings } from "@/lib/scheduled-briefing";
import { agentConfigured } from "@/lib/stream";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Scheduled treasurer run. Called by a systemd timer, not by a browser session. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Scheduled runs are not configured." }, { status: 503 });
  const given = req.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!agentConfigured()) return NextResponse.json({ error: "The agent needs an API key." }, { status: 503 });
  return NextResponse.json(await runScheduledBriefings({ origin: baseUrl(req) }));
}
