import { NextResponse } from "next/server";
import { withAccount } from "@/lib/authorize";
import { currentAccount } from "@/lib/account-context";
import { revokeAgentKey } from "@/lib/agent-keys";

export const dynamic = "force-dynamic";

export const DELETE = withAccount(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!revokeAgentKey(currentAccount().id, id)) return NextResponse.json({ error: "Unknown key." }, { status: 404 });
  return NextResponse.json({ ok: true });
});
