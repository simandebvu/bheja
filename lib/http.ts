import { NextResponse } from "next/server";

export function fail(err: unknown, status = 400) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[bheja]", message);
  return NextResponse.json({ error: message }, { status });
}

export function baseUrl(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
