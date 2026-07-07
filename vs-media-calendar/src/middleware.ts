import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Cookie-based auth check for edge runtime
// Full auth validation happens in each route/layout
export function middleware(req: NextRequest) {
  const { nextUrl } = req
  const pathname = nextUrl.pathname

  // Public paths — always allowed
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/api/onboarding") ||
    pathname.startsWith("/demo") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/webhooks/stripe" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next()
  }

  // Check for NextAuth v5 (Auth.js) session cookie
  // v5 uses "authjs." prefix (not "next-auth."); HTTPS uses __Secure- prefix
  const sessionToken =
    req.cookies.get("authjs.session-token") ||
    req.cookies.get("__Secure-authjs.session-token") ||
    req.cookies.get("next-auth.session-token") ||
    req.cookies.get("__Secure-next-auth.session-token")

  if (!sessionToken) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
}
