import { describe, it, expect } from "vitest";
import { markAppliedBatchHandler } from "./annotations";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * These tests guard the per-script auth memo in markAppliedBatch, not the
 * ProseMirror side (covered by lib/tiptap/*). The memo checks ownership once
 * per *distinct* scriptId — the risk it must not introduce is skipping the
 * check for a second, different, un-owned script slipped into the same batch.
 *
 * A hand-built ctx is honest here: the property under test is control flow
 * (does the distinct un-owned scriptId still reach requireScriptOwner), which
 * a stub exercises directly without needing the real Convex runtime.
 */

const OWNER_TOKEN = "tok-owner";
const OWNER_ID = "user_owner";

type Row = Record<string, unknown> & { _id: string };

function makeCtx(store: Record<string, Row>) {
  let identityCalls = 0;
  const patched: string[] = [];

  const ctx = {
    auth: {
      getUserIdentity: async () => {
        identityCalls += 1;
        return { tokenIdentifier: OWNER_TOKEN };
      },
    },
    db: {
      get: async (id: string) => store[id] ?? null,
      // requireScriptOwner does users.query().withIndex().unique(); the owner
      // is the only user this stub knows.
      query: () => ({
        withIndex: () => ({
          unique: async () => ({ _id: OWNER_ID }),
        }),
      }),
      patch: async (id: string) => {
        patched.push(id);
      },
    },
  } as unknown as MutationCtx;

  return { ctx, patched, identityCalls: () => identityCalls };
}

const ids = (...names: string[]) => names as unknown as Id<"annotations">[];

describe("markAppliedBatchHandler auth memo", () => {
  it("rejects a batch that mixes in another user's script", async () => {
    const { ctx, patched } = makeCtx({
      scriptA: { _id: "scriptA", userId: OWNER_ID },
      scriptB: { _id: "scriptB", userId: "user_other" },
      annA: { _id: "annA", scriptId: "scriptA" },
      annB: { _id: "annB", scriptId: "scriptB" },
    });

    await expect(
      markAppliedBatchHandler(ctx, { annotationIds: ids("annA", "annB") })
    ).rejects.toThrow(/authorized/i);

    // The un-owned row must never be marked applied.
    expect(patched).not.toContain("annB");
  });

  it("applies a same-script batch and checks ownership only once", async () => {
    const { ctx, patched, identityCalls } = makeCtx({
      scriptA: { _id: "scriptA", userId: OWNER_ID },
      annA: { _id: "annA", scriptId: "scriptA" },
      annA2: { _id: "annA2", scriptId: "scriptA" },
    });

    await markAppliedBatchHandler(ctx, {
      annotationIds: ids("annA", "annA2"),
    });

    expect(patched).toEqual(["annA", "annA2"]);
    // The memo collapses two same-script rows into a single auth round-trip.
    expect(identityCalls()).toBe(1);
  });
});
