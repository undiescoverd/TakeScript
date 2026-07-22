# Anchor-rate fixtures

`anchor-rate.test.ts` measures the single biggest risk in AI-authored anchored
suggestions: **does the model actually quote the document verbatim often enough
for its notes to be pinned to real text?** Below roughly 70%, the feature is a
list of comments that mostly point at nothing, and the prompt needs fixing
before the UI is built on top of it.

There are two kinds of fixture here, and they are **not** interchangeable.

## `real-*.json` — the aggregate gate

Harvested from actual Check Grammar runs against actual scripts. These, and only
these, feed the `anchored / total >= 0.70` assertion. Hand-authored fixtures
cannot substitute: a fixture written to pass a threshold measures nothing but
its own author.

**These must be harvested manually — the test suite cannot generate them.**

### How to harvest

1. Run the app (`npx convex dev`, `npm run dev`) and open a real script — ideally
   4–6 of them, varied: a long tutorial, one with heavy custom blocks, one with
   lots of dialogue/speaker marks, one recently edited.
2. Trigger Check Grammar and wait for it to finish. Outside production, the
   handler stashes the pair this format needs on `window.__lastGrammarHarvest`
   and logs `[harvest] ...` to the console when it is ready. (Neither the
   editor nor the action result is reachable from the console otherwise; the
   hook lives in `app/(app)/script/[id]/page.tsx`, in `handleGrammarCheck`.)
3. In the browser console:

   ```js
   copy(JSON.stringify({
     name: "onboarding-tutorial",
     source: "script <id>, checked <date>",
     ...window.__lastGrammarHarvest,
   }, null, 2))
   ```

4. Save as `real-<slug>.json` in this directory.

Scrub anything confidential first — these files are committed.

## `adversarial-*.json` — behavioural cases

Hand-authored, and deliberately excluded from the aggregate ratio. Each asserts
a *specific* documented behaviour (this quote anchors despite smart quotes; this
paraphrase correctly fails to anchor rather than mis-anchoring). Some are
*supposed* to fail anchoring — that is the point, so averaging them into a
success rate would be meaningless.

## Format

```jsonc
{
  "name": "human-readable name",
  "source": "where this came from",
  "docJSON": { "type": "doc", "content": [/* ProseMirror JSON */] },
  "issues": [ /* the grammar-check action's `issues` array, verbatim */ ]
}
```

Documents rehydrate through `fixture-schema.ts`, which is intentionally
permissive about attributes so a harvested doc does not fail to parse over an
attribute nobody anticipated.
