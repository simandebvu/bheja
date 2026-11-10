import { getAuth } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    return await (await getAuth()).handler(request);
  } catch {
    return Response.json({ message: "Authentication is unavailable. Please try again later." }, { status: 503 });
  }
}
export { handle as GET, handle as POST };
