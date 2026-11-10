import { withAccount } from "@/lib/authorize";
import { memberView } from "@/lib/invitations";
import { fail } from "@/lib/http";
export const dynamic = "force-dynamic";
export const GET = withAccount(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try { return Response.json(memberView((await params).id)); }
  catch { return fail("This membership is no longer available. Your treasurer may have updated the circle; check for a new invitation.", 404); }
});
