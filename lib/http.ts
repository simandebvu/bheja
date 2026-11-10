import { NextResponse } from "next/server";

export function fail(err: unknown, status = 400) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[rotapot]", message);
  return NextResponse.json({ error: message }, { status });
}

export function baseUrl(_req: Request): string {
  return new URL(process.env.BETTER_AUTH_URL!).origin;
}
