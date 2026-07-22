/**
 * The feature's central risk, as a repeatable gate.
 *
 * Anchored suggestions only work if the model quotes the document verbatim
 * often enough to be pinned to real text. That is a property of the PROMPT and
 * the MODEL, not of this code, and it can only be measured against genuine
 * Check Grammar output — so the aggregate gate runs on `real-*.json` fixtures
 * that must be harvested by hand (see __fixtures__/README.md).
 *
 * Two rules keep this honest:
 *
 *  - Hand-authored `adversarial-*.json` fixtures are EXCLUDED from the ratio.
 *    Several of them are supposed to fail anchoring; averaging them in would
 *    measure nothing. They assert specific documented behaviours instead.
 *  - With no real fixtures present the gate does not quietly pass. It reports
 *    itself as unmet, loudly, so a green suite never gets mistaken for a
 *    measured one.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Node as PMNode } from "@tiptap/pm/model";
import { fixtureSchema } from "./__fixtures__/fixture-schema";
import {
  buildSuggestionBatch,
  type AIIssue,
} from "./build-suggestion-batch";
import type { ResolveFailure } from "./resolve-text-position";

/** The rate below which the prompt needs fixing before shipping wide. */
const MIN_ANCHOR_RATE = 0.7;

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");

interface Expectation {
  index: number;
  why: string;
  anchored: boolean;
  reason?: ResolveFailure;
  selectedText?: string;
}

interface Fixture {
  name: string;
  source?: string;
  docJSON: unknown;
  issues: AIIssue[];
  expectations?: Expectation[];
}

function loadFixtures(prefix: string): Array<{ file: string; data: Fixture }> {
  if (!existsSync(FIXTURE_DIR)) return [];
  return readdirSync(FIXTURE_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort()
    .map((file) => ({
      file,
      data: JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8")) as Fixture,
    }));
}

function rehydrate(fixture: Fixture): PMNode {
  return PMNode.fromJSON(fixtureSchema, fixture.docJSON as never);
}

const realFixtures = loadFixtures("real-");
const adversarialFixtures = loadFixtures("adversarial-");

describe("anchor rate (aggregate gate on harvested fixtures)", () => {
  it("has real harvested fixtures to measure against", () => {
    if (realFixtures.length === 0) {
      console.error(
        [
          "",
          "  ANCHOR-RATE GATE NOT MEASURED",
          "  ------------------------------------------------------------",
          "  No real-*.json fixtures found in lib/tiptap/__fixtures__/.",
          "",
          "  The >=70% anchor-rate assertion is the whole point of this",
          "  suite and it is currently measuring NOTHING. The rest of the",
          "  suite passing does not mean AI suggestions will anchor.",
          "",
          "  Harvest 4-6 {docJSON, issues} pairs from real Check Grammar",
          "  runs -- see lib/tiptap/__fixtures__/README.md for the exact",
          "  console snippet -- and commit them as real-<slug>.json.",
          "  ------------------------------------------------------------",
          "",
        ].join("\n")
      );
    }
    // Deliberately a real assertion, not a skip: the gate is unmet until the
    // harvest happens, and the suite should say so every run.
    expect(
      realFixtures.length,
      "No real-*.json fixtures: the anchor-rate gate is unmeasured (see console output above)"
    ).toBeGreaterThan(0);
  });

  it.skipIf(realFixtures.length === 0)(
    `anchors at least ${MIN_ANCHOR_RATE * 100}% of quoted issues`,
    () => {
      let total = 0;
      let anchored = 0;
      const failures: Record<string, number> = {};
      const perFixture: string[] = [];

      for (const { file, data } of realFixtures) {
        const stats = buildSuggestionBatch(rehydrate(data), data.issues).stats;
        total += stats.total;
        anchored += stats.anchored;
        for (const [reason, count] of Object.entries(stats.failures)) {
          failures[reason] = (failures[reason] ?? 0) + count;
        }
        const pct = stats.total
          ? ((stats.anchored / stats.total) * 100).toFixed(0)
          : "n/a";
        perFixture.push(`    ${file}: ${stats.anchored}/${stats.total} (${pct}%)`);
      }

      // Logged unconditionally: the breakdown is what tells you WHICH prompt
      // rule the model is violating when the rate sags.
      console.log(
        [
          "",
          `  Anchor rate: ${anchored}/${total} = ${((anchored / total) * 100).toFixed(1)}%`,
          ...perFixture,
          "  Failure reasons:",
          ...Object.entries(failures)
            .filter(([, n]) => n > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([reason, n]) => `    ${reason}: ${n}`),
          "",
        ].join("\n")
      );

      expect(total).toBeGreaterThan(0);
      expect(anchored / total).toBeGreaterThanOrEqual(MIN_ANCHOR_RATE);
    }
  );
});

describe("adversarial anchoring behaviours", () => {
  it("has adversarial fixtures", () => {
    expect(adversarialFixtures.length).toBeGreaterThan(0);
  });

  for (const { file, data } of adversarialFixtures) {
    describe(`${file} (${data.name})`, () => {
      const batch = buildSuggestionBatch(rehydrate(data), data.issues);

      for (const exp of data.expectations ?? []) {
        it(`issue ${exp.index}: ${exp.why}`, () => {
          const suggestion = batch.suggestions[exp.index];
          expect(suggestion).toBeDefined();
          expect(suggestion.anchored).toBe(exp.anchored);

          if (exp.anchored) {
            expect(suggestion.selectedText).toBe(exp.selectedText);
            // An anchored row must have a mark pointing back at it.
            expect(batch.marks.some((m) => m.index === exp.index)).toBe(true);
          } else {
            expect(suggestion.from).toBe(0);
            expect(suggestion.to).toBe(0);
            expect(suggestion.suggestedText).toBeUndefined();
            expect(batch.marks.some((m) => m.index === exp.index)).toBe(false);
          }
        });
      }

      it("reports one failure count per unanchored issue", () => {
        const unanchored = batch.suggestions.filter((s) => !s.anchored).length;
        const counted = Object.values(batch.stats.failures).reduce(
          (a, b) => a + b,
          0
        );
        expect(counted).toBe(unanchored);
      });
    });
  }
});
