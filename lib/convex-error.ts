import { ConvexError } from "convex/values";

/**
 * Pull a message worth showing a user out of a failed Convex call.
 *
 * Convex only sends `ConvexError.data` to the client in production; every
 * other thrown error arrives as a redacted "Server Error". So a server that
 * wants to tell the user something actionable ("re-enter your key in
 * Settings -> AI") must throw ConvexError, and the client must read `.data`
 * rather than `.message`.
 *
 * Anything else is a genuine internal failure with nothing useful in it, and
 * gets the caller's fallback text.
 */
export function userFacingError(error: unknown, fallback: string): string {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  return fallback;
}
