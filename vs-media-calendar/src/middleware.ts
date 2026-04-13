import { auth } from "@/auth"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export default auth(function middleware(req) {
  const { nextUrl } = req
  const session = (req as any).auth
  const pathname = nextUrl.pathname

  // Public paths
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/webhooks/stripe"
  ) {
    return NextResponse.next()
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const role = session?.user?.role as string | undefined

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (
    pathname.startsWith("/videographer") &&
    role !== "VIDEOGRAPHER" &&
    role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (
    pathname.startsWith("/consultant") &&
    role !== "CONSULTANT" &&
    role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
}
