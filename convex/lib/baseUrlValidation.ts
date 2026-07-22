/**
 * SSRF guard for user-supplied custom-provider base URLs.
 *
 * Convex actions fetch these URLs server-side, so a hostile baseUrl could
 * probe internal infrastructure. The Convex default runtime has no DNS API,
 * so this is lexical validation: https only, no embedded credentials, no
 * literal IP addresses, and no localhost / link-local / cloud-metadata
 * hostnames. Callers must also fetch with `redirect: "manual"` so a 3xx
 * cannot bounce the request to a blocked host.
 */

const BLOCKED_HOSTNAMES = ["localhost", "metadata.goog", "metadata.google.internal"];
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal"];

export function assertSafeCustomBaseUrl(baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("Invalid base URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("Custom provider base URL must use https://");
  }

  if (url.username || url.password) {
    throw new Error("Base URL must not contain credentials");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (BLOCKED_HOSTNAMES.includes(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new Error("Base URL must point to a public host");
  }

  // Literal IPs (IPv4 or IPv6) are rejected outright — public endpoints have
  // hostnames, and this closes the private/loopback/metadata IP ranges.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    throw new Error("Base URL must use a hostname, not an IP address");
  }
}
