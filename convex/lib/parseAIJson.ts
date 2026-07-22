/**
 * Tolerant JSON extraction for AI responses.
 *
 * Models routinely wrap JSON in ```json fences or prepend a sentence of prose,
 * so a bare JSON.parse throws on otherwise-good responses. Callers get a
 * discriminated result and are expected to throw on failure — returning a
 * truthy error object reads downstream as a successful empty result.
 */

export type ParseAIJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "truncated" | "invalid" | "empty"; raw: string };

/** Strip ```json / ``` fences and any prose around them. */
export function stripFences(s: string): string {
  const fenced = s.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)(?:\n?```|$)/);
  return (fenced ? fenced[1] : s).trim();
}

/**
 * Scan from the first `{` and return the first balanced object.
 *
 * Brace depth is tracked outside of string literals only — a `}` inside a
 * "suggestion" value must not close the object. Returns null when depth never
 * returns to zero, which means the response was cut off mid-object.
 */
export function extractFirstBalancedObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }

  return null; // never balanced => truncated
}

/**
 * Parse an AI response into JSON.
 *
 * Logs a prefix of the raw body server-side for debugging but never returns it
 * to the client — callAI deliberately suppresses custom-provider error bodies
 * and this matches that posture.
 */
export function parseAIJson<T>(raw: string): ParseAIJsonResult<T> {
  if (!raw || !raw.trim()) {
    console.warn("[parseAIJson] empty response from provider");
    return { ok: false, reason: "empty", raw: raw ?? "" };
  }

  const cleaned = stripFences(raw);

  // Fast path: the model actually followed instructions.
  try {
    return { ok: true, data: JSON.parse(cleaned) as T };
  } catch {
    // fall through to balanced-object extraction
  }

  const candidate = extractFirstBalancedObject(cleaned);
  if (candidate === null) {
    // No `{` at all means the model answered in prose; a `{` that never
    // balances means the response was cut off. Different user-facing advice.
    const reason = cleaned.includes("{") ? "truncated" : "invalid";
    console.warn(
      `[parseAIJson] ${reason}: no balanced JSON object. raw[0:500]=${raw.slice(0, 500)}`
    );
    return { ok: false, reason, raw };
  }

  try {
    return { ok: true, data: JSON.parse(candidate) as T };
  } catch {
    console.warn(
      `[parseAIJson] invalid JSON after extraction. raw[0:500]=${raw.slice(0, 500)}`
    );
    return { ok: false, reason: "invalid", raw };
  }
}
