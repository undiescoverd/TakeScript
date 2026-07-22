# Codex Review Fixes — Implementation Plan

Findings from a Codex review of committed code (HEAD = `f4bc149`), independently
verified against the source. All six code fixes below are on **finished,
committed work** — none touch the in-flight BYOK/AI-provider changes.

**Baseline, established on this branch before any of these changes:**

- `npm run build` **passes.** If it fails after your edits, you caused it.
- `npm run lint` **fails** with pre-existing errors (see Task 7). Do not treat
  lint failure as a regression signal; compare against the pre-existing set.
- **There is no test infrastructure in this repo** — no `test` script, no
  vitest/jest/playwright. Do not build any. This means several fixes below can
  only be verified by a human in a browser; those are tagged explicitly.

**How verification is tagged.** Each task's checks are marked:

- `[agent]` — you can and must run this yourself.
- `[human]` — requires a running dev environment, a browser, or the Convex
  dashboard. **You cannot do these.** List them in your report as outstanding.
  Never report a `[human]` check as verified.

**Ground rules for the executing agent:**

- Do the tasks in order. Task 1 is the only one with data-loss impact.
- After each task, run `npx tsc --noEmit` before moving on.
- After changing anything in `convex/`, run `npx convex codegen` and commit the
  updated files under `convex/_generated/` — Vercel builds depend on them.
- Commit each task separately using the message given at the end of the task.
- Do **not** refactor beyond what each task specifies. Several of these files
  have subtle concurrency comments; preserve them.
- If a task's premise no longer matches the code you find, stop and report
  rather than improvising a different fix.

---

## Task 1 — Autosave silently discards edits after a metadata change (HIGH)

### The bug

`convex/scripts.ts` `update` implements optimistic concurrency: the client sends
`expectedLastEditedAt`, and the server returns `{ applied: false }` if the
script changed underneath it (scripts.ts:477-481).

But three other mutations bump `lastEditedAt` **without changing content**:

- `updateTitle` (scripts.ts:522)
- `updateSpeakers` (scripts.ts:651)
- `updateStage` (scripts.ts:703) and `reorderInStage` (scripts.ts:768)

The client only resyncs its baseline in the effect at
`app/(app)/script/[id]/page.tsx:181-221`, which calls
`syncLastEditedAt(script.lastEditedAt)` at line 216. That line is unreachable
when content is unchanged, because the effect returns early at line 200:

```ts
if (contentEqual(script.content, lastSaved) && !isRestoringVersionRef.current) {
  return;
}
```

So after a title/speaker/stage change the client's `lastEditedAtRef` is stale.
The next content autosave gets `applied: false`, and `use-autosave.ts:68-70`
clears `pendingContentRef` — **the edit is dropped with only a console warning.**

Trigger is a normal flow: assign a speaker mid-edit (which is exactly how the
speaker feature is used), keep typing. The next keystroke does recover (the
baseline is resynced at use-autosave.ts:48), but if the user blurs, navigates,
or closes the tab in that window the delta is gone.

### The fix

In `app/(app)/script/[id]/page.tsx`, resync the baseline **before** the
content-unchanged early return, inside that branch only.

```ts
// Skip update if this is the same content we just saved (autosave feedback loop)
if (contentEqual(script.content, lastSaved) && !isRestoringVersionRef.current) {
  // Content is unchanged but `lastEditedAt` moved — a metadata mutation
  // (title/speakers/stage) touched the script. Resync the optimistic-
  // concurrency baseline so the next content save isn't rejected as stale
  // and silently dropped.
  syncLastEditedAt(script.lastEditedAt);
  return;
}
```

**Critical constraint:** the resync must stay confined to this
content-unchanged branch. Do *not* move it to the top of the effect or make it
unconditional — that would defeat genuine conflict detection when a second
session edits the same script's content.

Leave the existing `syncLastEditedAt` call at line 216 in place; it handles the
version-restore path.

### Verification

`[agent]` `npx tsc --noEmit` passes.

`[agent]` Re-read the effect and confirm the resync sits inside the
content-unchanged branch only, and that the line-216 call is untouched.

`[human]` **This is a data-loss fix with no automated coverage — it ships
reasoning-only until someone runs this.** Flag it prominently in your report.
In a running dev environment (`npx convex dev` + `npm run dev`):

1. Open a script, type a few words, wait for "Saved".
2. Rename the script (or assign a speaker to a selection).
3. Immediately type more text, wait ~3s for the autosave.
4. Reload the page. **The text from step 3 must be present.**
5. Check the browser console — there must be no
   `"Autosave write skipped: script was changed externally"` warning.

`[human]` Re-verify the case the concurrency check exists for: open the same
script in two tabs, edit content in both, and confirm the loser is still
rejected rather than clobbering.

Commit: `fix: resync autosave baseline after script metadata changes`

---

## Task 2 — Dashboard "Completed" stat is permanently zero (MEDIUM)

### The bug

`convex/analytics.ts:59-62` counts `s.status === "complete"`. A repo-wide grep
for `"complete"` returns exactly two hits: the schema comment
(`convex/schema.ts:59`) and this filter. **Nothing in the codebase ever writes
that value.** The Kanban flow — the implemented workflow — writes `stageId`
only. So the stat reads 0 for every user, always.

### The decision (already made — implement it, don't re-litigate)

`stageId` is the canonical workflow state. `status` is vestigial. Analytics
should derive "completed" from the user's **last Kanban stage**, which handles
users who renamed or customised their stages (stage IDs are arbitrary strings —
see `convex/kanban.ts` `updateStages`, which only enforces uniqueness).

### The fix

In `convex/analytics.ts`:

1. Import the existing helper: `import { getStagesForUser } from "./kanban";`
   (already exported at `convex/kanban.ts:9`, and already used this way in
   `convex/scripts.ts:3`).
2. In `getUserStats`, after the user lookup, fetch the stages and treat the
   final stage as the completion stage:

```ts
const stages = await getStagesForUser(ctx, user._id);
const completedStageId = stages[stages.length - 1]?.id;

// Scripts sitting in the final Kanban stage count as completed. `stageId` is
// the canonical workflow state; the legacy `status` field is never written.
const completedScripts = completedStageId
  ? scripts.filter((s) => s.stageId === completedStageId).length
  : 0;
```

3. Delete the old `s.status === "complete"` filter.

Do **not** remove the `status` field from the schema in this task — other
records may carry values and a schema change needs its own migration review.
Instead, update the comment at `convex/schema.ts:59` to mark it deprecated:

```ts
// DEPRECATED: never written; `stageId` is the canonical workflow state.
status: v.optional(v.string()),
```

### Verification

`[agent]` `npx tsc --noEmit` passes, and the old `status === "complete"` filter
is gone (re-grep to confirm the only remaining hit is the schema comment).

`[human]` Move a script into the last Kanban column on the dashboard and
confirm the "Completed" figure increments. Move it back out and confirm it
decrements.

Commit: `fix: derive completed-script stat from Kanban stage`

---

## Task 3 — `scripts.create` bypasses template ownership (LOW-MEDIUM)

### The bug

`convex/templates.ts` `get` correctly gates access: system templates are public,
user templates require `template.userId === user._id` (templates.ts:125-156).

`convex/scripts.ts` `create` does not. At scripts.ts:308-317 it calls
`ctx.db.get(args.templateId)` on any supplied ID, copies the content into a new
script, and patches `lastUsedAt` on someone else's row.

Practical exploitability is low — Convex document IDs are opaque random strings,
not enumerable, so an attacker needs a leaked ID. This is a defense-in-depth
gap, not an open door. Fix it because the authorization rule should live in one
place, not because it is currently being exploited.

### The fix

Add a shared helper and use it in both call sites.

In `convex/templates.ts`, export a helper next to the existing `get` query:

```ts
/**
 * Resolve a template the given user is allowed to read: system templates are
 * public, user templates require ownership. Returns null when the template is
 * missing or not accessible. Both `templates.get` and `scripts.create` must go
 * through this so the rule lives in one place.
 */
export async function getAccessibleTemplate(
  ctx: QueryCtx,
  templateId: Id<"templates">,
  userId: Id<"users">
) {
  const template = await ctx.db.get(templateId);
  if (!template) return null;
  if (template.isSystem) return template;
  return template.userId === userId ? template : null;
}
```

Import `QueryCtx` from `./_generated/server` and `Id` from
`./_generated/dataModel` if not already imported.

Then:

- Rewrite `templates.get` to use it — but **`get` cannot delegate wholesale.**
  The helper requires a `userId`, and `get` deliberately serves system templates
  to *unauthenticated* callers (templates.ts:133-143). So `get` must keep its
  own "no identity → return the template if `isSystem`, else `null`" branch, and
  only call the helper once a user has been resolved. Breaking anonymous
  system-template reads is a regression.
- In `scripts.ts` `create`, replace `const template = await ctx.db.get(args.templateId)`
  with `const template = await getAccessibleTemplate(ctx, args.templateId, user._id)`.
  (`create` always has an authenticated `user`, so it can delegate fully.)

Keep the existing fallback behaviour in `create`: when the template resolves to
`null`, fall through to `getTemplateContent()` rather than throwing. Silently
falling back matches today's behaviour for a missing template and avoids
turning a stale template ID into a hard error for legitimate users.

### Verification

`[agent]` `npx tsc --noEmit` passes.

`[agent]` Confirm by reading that `templates.get` still returns system templates
when `ctx.auth.getUserIdentity()` is null.

`[human]` Creating a script from a system template still works; creating from
your own template still works and updates `lastUsedAt`.

Commit: `fix: enforce template ownership when creating scripts`

---

## Task 4 — `aiRequests.create` accepts client-supplied accounting fields (LOW-MEDIUM)

### The bug

`convex/aiRequests.ts:8-45` validates that `args.userId` matches the caller, but
takes `organizationId`, `cost`, `tokensUsed`, `provider`, and `model` verbatim
from the client. A user can inflate or zero their own usage numbers with no
foreign ID required.

**Scope note:** Codex called this a billing risk. It is not — I grepped every
consumer of the `aiRequests` table and the only one is the delete cascade at
`convex/scripts.ts:584`. Nothing charges off these records. This is
**usage/analytics integrity**, and it matters more if billing is built on this
table later.

### The fix

Derive ownership fields server-side instead of trusting them.

In `convex/aiRequests.ts` `create`:

1. Drop `userId` and `organizationId` from `args`.
2. Derive both from the authenticated identity — the handler already looks the
   user up via `getUserByTokenIdentifier`; use `user._id` and
   `user.organizationId`. Throw if the user has no `organizationId`.
3. Keep `scriptId`, `requestType`, `provider`, `model`, `tokensUsed`, and `cost`
   as args (the caller is the only thing that knows them), but add a short
   comment noting they are self-reported and not suitable for billing without
   server-side metering.

Then update the single call site, `convex/ai.ts:319`, to stop passing `userId`
and `organizationId`.

If `scriptId` is supplied, also verify the script belongs to the caller, using
the same ownership pattern as `scripts.update`.

### Verification

`[agent]` `npx tsc --noEmit` must pass — removing the args is what surfaces any
call site you missed, so a clean typecheck is meaningful coverage here.

`[human]` Trigger an AI request in the app and confirm a record still lands in
the `aiRequests` table with the correct `userId`/`organizationId` (Convex
dashboard).

Commit: `fix: derive AI request ownership server-side`

---

## Task 5 — Invitation list exposes tokens to all org members (LOW)

### The bug

`convex/invitations.ts:93-107` — `list` authenticates the caller but performs no
role check, returning full invitation records including `token` to any member,
including viewers.

**Severity note:** Codex rated this Medium-High. It is lower, because `accept`
enforces `invitation.email === user.email` (invitations.ts:~175). A leaked token
is **not redeemable by a different identity**. The actual exposure is disclosure
of pending invitees' email addresses and roles to all org members.

### The fix

Add the same role gate used elsewhere in this file (invitations.ts:29 and :248):

```ts
if (user.role !== "owner" && user.role !== "admin") {
  return [];
}
```

Return `[]` rather than throwing — `TeamManagement.tsx:143` already guards on
`invitations && invitations.length > 0`, so a non-privileged member simply sees
no pending-invitations section, while throwing would surface an error state.

**Do not strip the `token` field.** `components/organization/TeamManagement.tsx`
lines 163-170 legitimately use it to build the copyable invite link for
owners/admins. Restricting *who* can call `list` is the whole fix.

### Verification

`[agent]` `npx tsc --noEmit` passes; the role check matches the existing pattern
at invitations.ts:29 and :248; the `token` field is still returned.

`[human]` As an owner/admin, the pending invitations list still renders and
"copy link" still produces a working invite URL. As a `member` or `viewer`, the
section disappears and no invitation data reaches the client.

Commit: `fix: restrict invitation listing to owners and admins`

---

## Task 6 — Orphaned guideline files and unenforced upload limit (MEDIUM)

### Two bugs, one file

**6a. Storage orphaning.** `convex/brandGuidelines.ts` `remove` (~line 155)
deletes the database row only. The uploaded file stays in Convex storage
forever. This *is* fixable: `components/brand-guidelines/UploadGuidelinesDialog.tsx:84`
stores the storage ID in the `fileUrl` field (`fileUrl: storageId`), so the
handle is available at delete time.

**6b. The 10MB limit is decorative.** `UploadGuidelinesDialog.tsx:124` advertises
"max 10MB" as display text only. There is no size check on the client or the
server — grep confirms no `MAX_FILE`/`10 * 1024` constant exists anywhere.

### The fix

**6a:** In `brandGuidelines.remove`, after the authorization check and before
deleting the row, delete the storage object. Note that `remove` is a `mutation`
and `ctx.storage.delete` is available in mutations, so this can stay in-place —
but `fileUrl` is typed as `v.optional(v.string())`, not `v.id("_storage")`, so
it needs a cast and a guard:

```ts
if (guideline.fileUrl) {
  try {
    await ctx.storage.delete(guideline.fileUrl as Id<"_storage">);
  } catch (error) {
    // The row is the source of truth for the user; a missing or already-
    // deleted storage object must not block removing the guideline.
    console.error("Failed to delete guideline file from storage:", error);
  }
}
await ctx.db.delete(args.guidelineId);
```

Also delete the matching `fileUploads` ownership row (queried via the
`by_storage` index — see `convex/fileUploads.ts:32`) so it does not accumulate.

**6b:** Add a shared constant and enforce it in both places:

- Define `export const MAX_GUIDELINE_FILE_BYTES = 10 * 1024 * 1024;` in a
  location both client and Convex can import (e.g. `lib/constants.ts`).
- In `UploadGuidelinesDialog.handleFileChange`, reject oversized files with a
  `toast.error` before upload begins.
- Enforce server-side too: in `convex/fileUpload.ts`, the `extractTextFromFile`
  action already fetches the blob (`ctx.storage.get`, fileUpload.ts:68) — check
  `file.size` there and reject before extracting. The client check alone is not
  enforcement.

  **The server check must clean up after itself.** By the time
  `extractTextFromFile` runs, the blob is already in storage (upload →
  `recordUpload` → extract). Throwing on an oversized file would leave exactly
  the orphan that Task 6a exists to prevent. So on rejection: delete the storage
  object and its `fileUploads` row *first*, then throw.

  ```ts
  const file = await ctx.storage.get(args.storageId);
  if (!file) throw new Error("File not found in storage");

  if (file.size > MAX_GUIDELINE_FILE_BYTES) {
    // The blob is already uploaded at this point — drop it before rejecting,
    // or we orphan the very file Task 6a cleans up.
    await ctx.storage.delete(args.storageId);
    // ...also remove the fileUploads ownership row (by_storage index)
    throw new Error("File exceeds the 10MB limit");
  }
  ```

  Note `extractTextFromFile` is an **action**, so removing the `fileUploads` row
  needs an internal mutation rather than direct `ctx.db` access — follow the
  existing pattern in `convex/fileUploads.ts`.

Rename the schema field from `fileUrl` to `storageId` **only if** you are
prepared to write a migration; otherwise leave the name and add a comment at
`convex/schema.ts:145` clarifying it holds a storage ID, not a URL.

### Verification

`[agent]` `npx tsc --noEmit` passes; the size constant is imported (not
duplicated) in both the client and the Convex action; the rejection path deletes
before throwing.

`[human]` Upload a guideline, then delete it. Confirm in the Convex dashboard
that the file is gone from storage and the `fileUploads` row is gone too.
Attempt an 11MB upload and confirm it is rejected client-side with a toast, and
that a direct call to the extraction action on an oversized file both throws
**and leaves nothing behind in storage**.

Commit: `fix: clean up guideline storage on delete and enforce upload limit`

---

## Task 7 — Lint errors (BACKLOG — do not attempt unless explicitly asked)

`npm run lint` currently reports errors across the project, dominated by the
newer `react-hooks` rules:

- `Calling setState synchronously within an effect` — many occurrences, spread
  across many components, not confined to the files Codex named.
- `components/editor/ScriptEditor.tsx:70` and `lib/tiptap/ChapterNodeView.tsx` —
  `Cannot access refs during render`. These are the genuinely interesting ones.

This is a cleanup backlog, not a defect list, and fixing setState-in-effect
patterns in the editor risks regressing the autosave and content-sync behaviour
that Task 1 touches. **Leave it alone in this pass.** If it is picked up later,
it should be a separate branch with the editor exercised manually.

---

## Wrap-up

After all six tasks:

1. `npm run build` must pass. It passed before you started, so any failure is
   yours.
2. `npx convex codegen`, and commit `convex/_generated/` if it changed.
3. Report per task: what changed, which `[agent]` checks you actually ran and
   their output, and every `[human]` check still outstanding. Do not report a
   task as verified if you only reasoned about it.
4. Call out Task 1 specifically: it is a data-loss fix that **no automated check
   in this repo can cover**. Whoever picks this up needs to run its `[human]`
   steps before trusting it.
