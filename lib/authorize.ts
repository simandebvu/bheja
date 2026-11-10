import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { accountContext } from "./account-context";

export async function requireSession() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) redirect("/");
  return session;
}

export function withAccount<C>(handler: (req: Request, context: C) => Promise<Response>) {
  return async (req: Request, context: C): Promise<Response> => {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user.emailVerified) return Response.json({ error: "Please sign in." }, { status: 401 });
    if (!["GET", "HEAD"].includes(req.method) && req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin) {
      return Response.json({ error: "Invalid request origin." }, { status: 403 });
    }
    return accountContext.run(session.user, () => handler(req, context));
  };
}
