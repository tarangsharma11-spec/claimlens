import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Middleware — runs on every request.
 *
 * 1. Public routes (login, pricing, demo, blog, api/auth) — pass through
 * 2. Dashboard routes — require auth, resolve org from session
 * 3. API routes — require auth, pass org context via headers
 *
 * The org resolution happens via the membership lookup in the API routes
 * themselves (getMembership). This middleware just handles auth gating.
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  const publicPaths = ["/login", "/pricing", "/demo", "/blog", "/api/auth", "/_next", "/favicon", "/verify", "/reset-password"];
  if (publicPaths.some((p) => pathname.startsWith(p)) || pathname === "/") {
    return NextResponse.next();
  }

  // Check auth token
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    // Redirect to login with callback URL
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // SSO users with pending_code status need to verify their access code
  if (token.status === "pending_code" && !pathname.startsWith("/verify") && !pathname.startsWith("/api/auth")) {
    return NextResponse.redirect(new URL("/verify", request.url));
  }

  // Attach user email to request headers for API routes
  const response = NextResponse.next();
  response.headers.set("x-user-email", token.email || "");
  response.headers.set("x-user-name", token.name || "");

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
  ],
};
