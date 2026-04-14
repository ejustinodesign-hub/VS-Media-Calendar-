import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Simple cookie-based middleware for edge runtime
// Full auth validation happens in each route/layout
export function middleware(req: NextRequest) {
  const { nextUrl } = req
  const pathname = nextUrl.pathname

  // Public paths — always allowed
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/demo") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/webhooks/stripe" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next()
  }

  // Check for NextAuth session cookie
  const sessionToken =
    req.cookies.get("next-auth.session-token") ||
    req.cookies.get("__Secure-next-auth.session-token")

  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
}
