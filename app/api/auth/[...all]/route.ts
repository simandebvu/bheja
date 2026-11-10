import { getAuth } from "@/lib/auth";
import { authEmailDelivery } from "@/lib/email";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    const auth = await getAuth();
    const delivery = { failed: false };
    const response = await authEmailDelivery.run(delivery, () => auth.handler(request));
    if (!delivery.failed) return response;
    // better-auth reports success even when the verification email failed to send.
    const flagged = new Response(response.body, response);
    flagged.headers.set("x-rotapot-email", "failed");
    return flagged;
  } catch {
    return Response.json({ message: "Authentication is unavailable. Please try again later." }, { status: 503 });
  }
}
export { handle as GET, handle as POST };
