import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isApiRoute = createRouteMatcher(["/api/(.*)"]);
const isProtectedPage = createRouteMatcher([
  "/",
  "/new",
  "/r/(.*)",
]);
const isAuthPage = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // API routes: Clerk session OR shared API key in header.
  if (isApiRoute(request)) {
    const { userId } = await auth();
    if (userId) return NextResponse.next();

    const expected = process.env.API_KEY;
    if (expected) {
      const provided =
        request.headers.get("x-api-key") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (provided === expected) return NextResponse.next();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // No API_KEY configured and no Clerk session => allow (dev mode)
    return NextResponse.next();
  }

  // Authenticated pages: require Clerk session, otherwise redirect to sign-in
  if (isProtectedPage(request) && !isAuthPage(request)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) return redirectToSignIn();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next internals and static
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/api/:path*",
  ],
};
