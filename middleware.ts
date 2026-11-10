import { NextResponse, type NextRequest } from "next/server";

/**
 * Treasurer pages need the (demo) sign-in. Member pay pages stay open: members
 * reach them from a WhatsApp link, like a PayPal.me link.
 */
export function middleware(req: NextRequest) {
  if (req.cookies.get("rotapot_session")?.value) return NextResponse.next();
  // Behind a reverse proxy, build the redirect from the public host, not the internal one.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const target = new URL(`${proto}://${host}/`);
  target.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(target);
}

export const config = { matcher: ["/circles", "/circles/:path*"] };
