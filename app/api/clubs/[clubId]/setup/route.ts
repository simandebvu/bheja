import { withAccount } from "@/lib/authorize";
import { deleteDraft, launchCircle, reviseCircle } from "@/lib/group-setup";
import { sendInvitation } from "@/lib/invitations";
import { fail } from "@/lib/http";
export const POST = withAccount(async (req: Request, { params }: { params: Promise<{ clubId: string }> }) => {
  try {
    const { clubId } = await params;
    const body = await req.json();
    if (body.action === "invite") return Response.json(await sendInvitation(clubId, body.memberId));
    if (body.action === "launch") return Response.json({ club: launchCircle(clubId) });
    if (body.action === "edit") return Response.json({ club: reviseCircle(clubId, body.circle) });
    if (body.action === "cancel") { deleteDraft(clubId); return Response.json({ ok: true }); }
    return fail("Unknown action.");
  } catch (error) { return fail(error); }
});
