import { describe, it, expect } from "vitest";
import { withOpenRouterCache } from "./ai";

/**
 * Locks the OpenRouter cache-control wire format. The deferral that held this
 * back was specifically about a malformed body breaking the default provider,
 * so the shape — and the "byte-identical when there's nothing to cache"
 * guarantee — is the thing worth pinning. A live-key run still verifies a real
 * routed model succeeds; this pins the bytes we send.
 */
describe("withOpenRouterCache", () => {
  it("marks the first system block cacheable and leaves the rest untouched", () => {
    const out = withOpenRouterCache([
      { role: "system", content: "STABLE identity + guidelines" },
      { role: "system", content: "per-request task" },
      { role: "user", content: "the prompt" },
    ]);

    expect(out[0]).toEqual({
      role: "system",
      content: [
        {
          type: "text",
          text: "STABLE identity + guidelines",
          cache_control: { type: "ephemeral" },
        },
      ],
    });
    // Only the stable prefix is transformed; everything after the breakpoint
    // stays a plain string and is billed normally.
    expect(out[1]).toEqual({ role: "system", content: "per-request task" });
    expect(out[2]).toEqual({ role: "user", content: "the prompt" });
  });

  it("returns the input unchanged when there is no leading system message", () => {
    const messages = [{ role: "user", content: "hello" }];
    expect(withOpenRouterCache(messages)).toBe(messages);
  });

  it("returns the input unchanged for an empty message list", () => {
    const messages: Array<{ role: string; content: string }> = [];
    expect(withOpenRouterCache(messages)).toBe(messages);
  });

  it("touches only the first message even with several system blocks", () => {
    const out = withOpenRouterCache([
      { role: "system", content: "first" },
      { role: "system", content: "second" },
      { role: "system", content: "third" },
    ]);
    expect(Array.isArray(out[0].content)).toBe(true);
    expect(out[1].content).toBe("second");
    expect(out[2].content).toBe("third");
  });
});
