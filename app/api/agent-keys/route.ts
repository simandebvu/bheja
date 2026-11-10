import { NextResponse } from "next/server";
import { withAccount } from "@/lib/authorize";
import { currentAccount } from "@/lib/account-context";
import { createAgentKey, listAgentKeys } from "@/lib/agent-keys";

export const dynamic = "force-dynamic";

export const GET = withAccount(async () => NextResponse.json({ keys: listAgentKeys(currentAccount().id) }));

export const POST = withAccount(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { token, key } = createAgentKey(currentAccount(), typeof body?.label === "string" ? body.label : "");
  return NextResponse.json({ token, key: { id: key.id, label: key.label, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt } }, { status: 201 });
});
