import { withAccount } from "@/lib/authorize";
import { resetDb } from "@/lib/db";
export const POST = withAccount(async () => { const db = resetDb(); return Response.json({ clubs: db.clubs }); });
