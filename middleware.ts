import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Note: /api routes are intentionally NOT public — any future API route is
// auth-protected by default and must opt out here explicitly.
const isPublicRoute = createRouteMatcher(["/", "/login(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
