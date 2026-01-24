# Script Writer Feature Comparison & Prioritized Improvements

Research into features script writers use daily (Final Draft, Celtx, WriterDuet, Arc Studio, Scrivener, Scripto, Descript, Teleprompter.com, etc.) compared to TakeScript. Recommendations are ordered by **priority** (impact × fit for tutorial/SaaS creators).

---

## What TakeScript Already Has (Strengths)

| Feature                         | TakeScript | Notes                                                                      |
| ------------------------------- | ---------- | -------------------------------------------------------------------------- |
| Rich text + custom blocks       | ✓          | Chapters, screen recording, demonstration, editor notes                    |
| Recording mode                  | ✓          | Hide editor notes for clean teleprompter view                              |
| Version history                 | ✓          | Save/restore snapshots with notes                                          |
| Teleprompter-style export       | ✓          | Plain text, copy for PrompSmart                                            |
| Word count & read time          | ✓          | 150 wpm estimate                                                           |
| Chapter navigation (Beat Board) | ✓          | Click to scroll, extractChapters                                           |
| Speaker attribution             | ✓          | Speakers, camera mode, Cmd+9/0/J, pending speaker                          |
| Slash commands                  | ✓          | Blocks, /speaker, AI commands                                              |
| AI assistance                   | ✓          | Chat, grammar check, script review, generate; brand guidelines; OpenRouter |
| Autosave                        | ✓          | 30s debounce                                                               |
| Comments                        | ✓          | CommentsPanel                                                              |
| Annotations                     | ✓          | Highlight + notes, resolve, colors                                         |
| Real-time collaboration         | ✓          | Hocuspocus + Yjs, CollaborationCursor, Collaborators                       |
| Sharing / team                  | ✓          | ShareDialog, orgs, invitations                                             |
| Templates                       | ✓          | Save, library, system templates                                            |
| Brand guidelines                | ✓          | Org-level, AI-aware                                                        |

---

## Gaps vs. Common Script-Writer Workflows

### 1. **Export & Teleprompter**

- **Competitors:** PDF export (Scripto, Celtx, StudioBinder, Final Draft), dedicated teleprompter apps (Teleprompter.com, Descript) with scroll speed, font size, optional “eye contact” AI.
- **TakeScript:** Copy-to-clipboard only for PrompSmart; no PDF, no in-app teleprompter UI.
- **Gap:** No PDF for review/print; no built-in teleprompter with controllable scroll.

### 2. **Track Changes / Revision Tracking**

- **Competitors:** Final Draft (Track Changes + Revision Mode), WriterDuet (line-level history, revert), Scripto (who changed what, when).
- **TakeScript:** Version snapshots only; no inline diff, no accept/reject per change, no revision colors.
- **Gap:** Harder to do structured review cycles and client/PM sign-off.

### 3. **Autocomplete / Smart Type**

- **Competitors:** Final Draft (SmartType: characters, locations, times, scene headings), Scrivener (project-based autocomplete for names, places).
- **TakeScript:** Slash commands and AI, but no proactive autocomplete for speaker names, block types, or frequent phrases.
- **Gap:** More typing and cognitive load for repeat elements.

### 4. **Script Breakdown / Tagging**

- **Competitors:** Celtx, StudioBinder (breakdowns: cast, props, locations, etc.; tagging for scheduling).
- **TakeScript:** Chapters and custom blocks; no explicit “breakdown” or tag-based filtering.
- **Gap:** Less support for production-style planning (even if simplified for tutorials).

### 5. **Templates & Scaffolding**

- **Competitors:** Genre/template presets (e.g. Teleprompter.com), structure templates (Arc Studio, WriterDuet).
- **TakeScript:** Template library and save-as-template; no “new from template” with predefined structure (e.g. intro → chapters → CTA).
- **Gap:** Slightly more manual setup for recurring formats.

### 6. **Print / Layout Control**

- **Competitors:** One- vs two-column, scene/section-only print, headers/footers, page breaks (Scripto, Celtx, etc.).
- **TakeScript:** No print-optimized layout or section-based print.
- **Gap:** Weaker for paper or PDF handouts.

### 7. **Mobile / Offline**

- **Competitors:** WriterDuet (mobile apps), some offline; Teleprompter.com (iOS/Android, sync).
- **TakeScript:** Web-only; no offline or mobile-optimized editor.
- **Gap:** Less useful on set or while traveling.

### 8. **AI Script Generation From Outline**

- **Competitors:** Restream, Teleprompter.com (topic → full script), tone/length controls.
- **TakeScript:** AI generate + chat + review; no dedicated “outline → full script” flow.
- **Gap:** Could streamline first-draft creation from bullet points or beat boards.

---

## Prioritized Improvements

### **P0 – Highest priority**

1. **PDF export**
   - **Why:** Universal for review, feedback, and print; expected by almost every script workflow.
   - **What:** Export script (and optionally version) to PDF; preserve chapters, block labels, basic structure. Use same content as `exportToPlainText` + simple styling.
   - **Scope:** Single “Export PDF” action; optional header/footer later.

2. **In-app teleprompter mode**
   - **Why:** Reduces context-switching (no PrompSmart-only flow); matches Descript/Teleprompter.com expectations.
   - **What:** Dedicated teleprompter view (fullscreen or modal) with:
     - Scroll speed control
     - Font size control
     - Same plain-text export as today (chapters, etc.), optionally “recording mode” (no editor notes).
   - **Scope:** New route or overlay; reuse `exportToPlainText` + simple scroll UI.

3. **Speaker / block autocomplete**
   - **Why:** High daily use (speaker names, block types); low effort, high perceived value (like SmartType/Scrivener).
   - **What:**
     - Suggest speaker names while typing (from current script’s speakers).
     - Suggest block types or slash-style inserts (e.g. `/chapter`, `/screen`).
   - **Scope:** Tiptap suggestion extension; trigger on `@` or `/` or after space in relevant contexts.

### **P1 – High priority**

4. **Track-changes-style workflow**
   - **Why:** Aligns with client/team review; version history exists but no per-change visibility.
   - **What:**
     - “Suggesting” or “review” mode: edits stored as suggestions (insertions/deletions).
     - Simple accept/reject (all or per change).
     - Optional visual diff view for a version vs current.
   - **Scope:** Non-trivial (likely new marks/storage); start with “compare version to current” diff UI, then add suggesting mode.

5. **“New from template” with structure**
   - **Why:** Templates exist; adding structure makes them more useful.
   - **What:** Create script from template with pre-filled structure (e.g. intro, 3 chapters, outro, screen recording placeholders). Tie to template metadata.
   - **Scope:** Extend `NewScriptDialog` and template application logic.

6. **Outline → AI first draft**
   - **Why:** Matches “idea → script” tools; leverages existing AI + brand guidelines.
   - **What:** Input: outline or bullet list (or Beat Board chapters). Output: generated first-draft script following structure. Use existing `generate` + structure parsing.
   - **Scope:** New AI action + small UI (e.g. “Generate from outline” in Beat Board or slash).

### **P2 – Medium priority**

7. **Print-optimized layout**
   - **Why:** Complements PDF; some users still print.
   - **What:** Print-specific CSS (and maybe view): readable font, page breaks at chapters, optional headers/footers. “Print” uses this view.
   - **Scope:** CSS + print route or hidden div.

8. **Section/chapter-only export**
   - **Why:** Match “print specific scenes” (Scripto, etc.); useful for partial teleprompter or handouts.
   - **What:** Select chapters (or a range) in Beat Board; “Export selection” → plain text or PDF for that slice only.
   - **Scope:** `exportToPlainText` (and PDF) with range filter; Beat Board checkboxes or range selector.

9. **Lightweight breakdown/tags**
   - **Why:** Celtx-style breakdown is overkill, but tags help.
   - **What:** Optional tags on chapters (e.g. “setup”, “demo”, “recap”) or blocks; filter Beat Board by tag. No full production breakdown.
   - **Scope:** Chapter (and maybe block) `attrs.tags`; filter in `extractChapters` and Beat Board.

### **P3 – Lower priority / later**

10. **Offline / PWA**
    - Service worker, cache script + recent data, sync when back online. Improves mobile and “on set” use.

11. **Mobile-optimized editor**
    - Touch-friendly layout, simplified toolbar, optional “mobile teleprompter” mode. Complements PWA.

12. **Export formats**
    - Beyond PDF: Fountain, .fdx, or DOCX for interchange with other tools. Lower priority than PDF and teleprompter.

---

## Summary Table

| Priority | Improvement                                        | Rationale                                    |
| -------- | -------------------------------------------------- | -------------------------------------------- |
| **P0**   | PDF export                                         | Universal expectation; unblocks review/print |
| **P0**   | In-app teleprompter                                | Core tutorial workflow; less app switching   |
| **P0**   | Speaker/block autocomplete                         | Daily use; similar to SmartType/Scrivener    |
| **P1**   | Track-changes-style workflow                       | Better review cycles; diff + suggest mode    |
| **P1**   | “New from template” with structure                 | Makes templates immediately actionable       |
| **P1**   | Outline → AI first draft                           | Strong fit for “idea → script”               |
| **P2**   | Print-optimized layout                             | Complements PDF                              |
| **P2**   | Section/chapter-only export                        | Flexible export for long scripts             |
| **P2**   | Lightweight breakdown/tags                         | Lightweight production-style planning        |
| **P3**   | Offline / PWA, mobile editor, extra export formats | Quality of life and power-user features      |

---

## Implementation Order Suggestion

1. **PDF export** – Clear win, well-scoped.
2. **Speaker/block autocomplete** – Fast to ship, high perceived value.
3. **In-app teleprompter** – Reuses export; completes “write → record” loop.
4. **“New from template” with structure** – Builds on existing templates.
5. **Outline → AI first draft** – Builds on existing AI + structure.
6. **Track-changes-style workflow** – Start with version diff UI, then suggesting mode.

Sources: Final Draft, Celtx, WriterDuet, Arc Studio, Fade In, Scrivener, Scripto, StudioBinder, Descript, Teleprompter.com, Restream (feature pages, comparison articles, help docs). TakeScript feature set from CLAUDE.md and codebase (as of this analysis).
