import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";

/**
 * Everything is behind the passcode except the passcode screen itself and the files
 * the phone needs before sign-in (manifest, icons, service worker).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const signedIn = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    if (signedIn) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!signedIn) {
    const url = new URL("/login", request.url);
    // Come back to where you were heading once the passcode is in.
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals, the PWA files and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.png|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
