import { NextResponse, type NextRequest } from "next/server";

/**
 * Treasurer pages need the (demo) sign-in. Member pay pages stay open: members
 * reach them from a WhatsApp link, like a PayPal.me link.
 */
export function middleware(req: NextRequest) {
  if (req.cookies.get("rotapot_session")?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/circles", "/circles/:path*"] };
