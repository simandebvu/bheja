import { withAccount } from "@/lib/authorize";
import { acceptInvitation, invitationPreview } from "@/lib/invitations";
import { fail } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try { return Response.json(invitationPreview((await params).token), { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }); }
  catch { return fail("This invitation is expired or no longer available. Ask your treasurer for a new one.", 404); }
}
export const POST = withAccount(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  try {
    const body = await req.json();
    if (body.acceptRules !== true) return fail("Please agree to the circle's contribution, rotation and rules.");
    return Response.json({ id: acceptInvitation((await params).token, body.paypalEmail) });
  } catch (error) { return fail(error); }
});
