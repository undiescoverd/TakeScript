# Kanban View Feature - Improved Implementation Plan

**Branch**: `kanban` (off `main`)
**Status**: Ready for Implementation
**Updated**: January 25, 2026

---

## Overview

Add a Trello-style Kanban view as a third view mode (Grid/List/Kanban) with 4 customizable stages, drag-drop support, and real-time sync across all views.

**Key Deliverables**:
- Third view mode toggle (Grid/List/Kanban)
- Kanban view with 4 columns and drag-drop support
- StatusBadge component in Grid/List views
- Stage customization dialog for names and colors
- Real-time two-way sync between all view modes
- Production-ready documentation

---

## Phase 1: Branch Setup & Schema Foundation

### Tasks
1. **Create feature branch**
   ```bash
   git checkout main && git pull origin main
   git checkout -b kanban
   ```

2. **Update `convex/schema.ts`**
   - Add to `scripts` table:
     ```typescript
     stageId: v.optional(v.string()),      // "draft" | "in-progress" | "review" | "ready"
     stageOrder: v.optional(v.number()),   // For ordering within columns
     ```
   - Add index: `by_user_and_stage: ["userId", "stageId"]`
   - Create new `kanbanStages` table:
     ```typescript
     kanbanStages: defineTable({
       userId: v.id("users"),
       stages: v.array(v.object({
         id: v.string(),
         name: v.string(),
         color: v.string()
       }))
     }).index("by_user", ["userId"])
     ```

3. **Create `convex/kanban.ts`** - Stage management functions:
   - `getOrCreateStages(userId)` - Returns user's stages, creates defaults if none
   - `updateStages(stages)` - Update all stage names/colors
   - `resetToDefaults()` - Reset stages to defaults

4. **Update `convex/scripts.ts`** - Add mutations:
   - `updateStage(scriptId, stageId)` - Move script to stage
   - `reorderInStage(scriptId, stageId, newOrder)` - Reorder within column

### Verification
- Run `npx convex dev` - schema deploys without errors
- Check Convex dashboard for new fields/indexes

### Commit
```bash
git add convex/
git commit -m "feat(kanban): add schema and backend mutations for stages"
```

---

## Phase 2: Types & State Management

### Tasks
1. **Create `types/kanban.ts`**
   ```typescript
   export interface KanbanStage {
     id: string;
     name: string;
     color: string;
   }

   export const DEFAULT_STAGES: KanbanStage[] = [
     { id: "draft", name: "Draft", color: "#6b7280" },
     { id: "in-progress", name: "In Progress", color: "#3b82f6" },
     { id: "review", name: "Review", color: "#f59e0b" },
     { id: "ready", name: "Ready", color: "#22c55e" }
   ];
   ```

2. **Update `store/folder-store.ts`**
   - Extend `ViewMode` type: `"grid" | "list" | "kanban"`
   - View mode already persisted via Zustand persist

3. **Create `hooks/use-kanban.ts`**
   - `useKanbanScripts()` - Fetches all scripts, groups by stageId client-side
   - `useKanbanStages()` - Fetches user's custom stages
   - Handle `stageId: undefined` as `"draft"` (migration compatibility)

### Verification
- TypeScript compiles without errors
- Run existing tests pass

### Commit
```bash
git add types/ store/ hooks/
git commit -m "feat(kanban): add types, state management, and hooks"
```

---

## Phase 3: StatusBadge Component (Shared)

### Tasks
1. **Create `components/dashboard/StatusBadge.tsx`**
   - Dropdown showing 4 stage options with colors
   - Props: `stageId`, `onChange`, `stages` (custom names/colors)
   - Uses Radix DropdownMenu or shadcn Select
   - Color-coded pills based on stage color

2. **Update `components/dashboard/ScriptCard.tsx`**
   - Add StatusBadge in card footer
   - Wire to `updateStage` mutation

3. **Update `components/dashboard/ListView.tsx`**
   - Add "Status" column with StatusBadge
   - Wire to `updateStage` mutation

### Verification
- Status changes in Grid view update database
- Status changes in List view update database
- Visual feedback shows during mutation

### Commit
```bash
git add components/dashboard/StatusBadge.tsx components/dashboard/ScriptCard.tsx components/dashboard/ListView.tsx
git commit -m "feat(kanban): add StatusBadge component to Grid and List views"
```

---

## Phase 4: Kanban View Components

**Can run in parallel with Phase 3** (different files)

### Tasks
1. **Install dnd-kit**
   ```bash
   npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
   ```

2. **Create `components/dashboard/KanbanCard.tsx`**
   - Script card for Kanban (compact)
   - Show title, last edited, word count
   - Draggable via dnd-kit useSortable
   - Context menu for actions

3. **Create `components/dashboard/KanbanColumn.tsx`**
   - Single stage column
   - Header with stage name, count, color indicator
   - Droppable zone with SortableContext
   - "+ Add Script" button at bottom

4. **Create `components/dashboard/KanbanView.tsx`**
   - Main Kanban layout with 4 columns
   - DndContext wrapper
   - Horizontal scroll on mobile
   - Settings icon for stage customization
   - Handle drag events → call mutations
   - Optimistic updates with rollback on error

### Verification
- Kanban renders 4 columns with correct stage names
- Cards are draggable between columns
- Drag-drop updates database
- Mobile horizontal scroll works

### Commit
```bash
git add components/dashboard/Kanban*.tsx package.json package-lock.json
git commit -m "feat(kanban): add KanbanView, KanbanColumn, KanbanCard components"
```

---

## Phase 5: View Integration

### Tasks
1. **Update `components/dashboard/ViewToggle.tsx`**
   - Add Kanban icon button (Columns or LayoutPanelLeft from lucide)
   - Handle 3-way toggle
   - Conditionally show Kanban button only at root level

2. **Update `components/dashboard/FolderMainPanel.tsx`**
   - Import KanbanView
   - Add conditional: `viewMode === "kanban" && !currentFolderId`
   - Show info message if Kanban selected in subfolder

### Verification
- Kanban button appears in ViewToggle at root
- Clicking button switches to Kanban view
- Kanban hidden/disabled in subfolders
- All 3 views work correctly

### Commit
```bash
git add components/dashboard/ViewToggle.tsx components/dashboard/FolderMainPanel.tsx
git commit -m "feat(kanban): integrate Kanban view into dashboard"
```

---

## Phase 6: Real-time Sync & Quick Create

**Can run in parallel with Phase 7** (different files)

### Tasks
1. **Test real-time sync**
   - Change status in Kanban → verify Grid/List update
   - Change status in List → verify Kanban updates
   - Convex `useQuery` reactivity handles this automatically

2. **Create `components/dashboard/QuickCreateDialog.tsx`**
   - Dialog for creating script from Kanban column
   - Title input, pre-selected stage
   - Calls `create` mutation with stageId

3. **Wire "+ Add Script" button in KanbanColumn**

### Verification
- Real-time sync works across all views
- Quick create adds script to correct column
- New script appears immediately

### Commit
```bash
git add components/dashboard/QuickCreateDialog.tsx components/dashboard/KanbanColumn.tsx
git commit -m "feat(kanban): add real-time sync and quick create"
```

---

## Phase 7: Stage Customization

**Can run in parallel with Phase 6** (different files)

### Tasks
1. **Create `components/dashboard/KanbanSettingsDialog.tsx`**
   - Modal showing all 4 stages
   - Editable name inputs
   - Color picker (hex input + preset palette)
   - Save, Reset to Defaults, Cancel buttons

2. **Wire settings button in KanbanView header**

3. **Update all stage-related components to use custom stages**

### Verification
- Settings dialog opens from Kanban header
- Can edit stage names and colors
- Changes persist to database
- All views reflect updated stage names/colors

### Commit
```bash
git add components/dashboard/KanbanSettingsDialog.tsx
git commit -m "feat(kanban): add customizable stage names and colors"
```

---

## Phase 8: Testing & Polish

### Tasks
1. **Manual testing checklist**
   - [ ] Kanban view loads at root level
   - [ ] 4 columns display with correct names
   - [ ] Drag cards between columns
   - [ ] Status badge changes sync everywhere
   - [ ] Quick create works
   - [ ] Stage customization saves and updates
   - [ ] Light/dark mode theming
   - [ ] Mobile responsiveness

2. **Fix any bugs found**

3. **Performance check**
   - Load with 50+ scripts
   - Check for unnecessary re-renders

4. **Accessibility**
   - Keyboard navigation
   - ARIA labels on interactive elements

### Verification
- All manual tests pass
- No console errors
- Performance acceptable

### Commit
```bash
git add .
git commit -m "fix(kanban): testing fixes and polish"
```

---

## Phase 9: Documentation & Cleanup

### Tasks
1. **Update `CLAUDE.md`**
   - Add Kanban section under Key Architectural Patterns
   - Document new mutations and hooks
   - Document component structure

2. **Code cleanup**
   - Remove console.logs
   - Verify no unused imports
   - Run `npm run lint`

3. **Final verification**
   - `npm run build` succeeds
   - No TypeScript errors

### Commit
```bash
git add CLAUDE.md
git commit -m "docs(kanban): update documentation"
```

---

## Key Files

### Create
| File | Purpose |
|------|---------|
| `types/kanban.ts` | Type definitions and default stages |
| `hooks/use-kanban.ts` | Data fetching and grouping hooks |
| `convex/kanban.ts` | Stage management mutations |
| `components/dashboard/StatusBadge.tsx` | Reusable status dropdown |
| `components/dashboard/KanbanView.tsx` | Main Kanban container |
| `components/dashboard/KanbanColumn.tsx` | Single stage column |
| `components/dashboard/KanbanCard.tsx` | Script card for Kanban |
| `components/dashboard/KanbanSettingsDialog.tsx` | Stage customization modal |
| `components/dashboard/QuickCreateDialog.tsx` | Create script from column |

### Modify
| File | Changes |
|------|---------|
| `convex/schema.ts` | Add stageId, stageOrder, kanbanStages table |
| `convex/scripts.ts` | Add stage mutations |
| `store/folder-store.ts` | Extend ViewMode type |
| `components/dashboard/ViewToggle.tsx` | Add Kanban button |
| `components/dashboard/FolderMainPanel.tsx` | Add Kanban conditional |
| `components/dashboard/ScriptCard.tsx` | Add StatusBadge |
| `components/dashboard/ListView.tsx` | Add status column |
| `CLAUDE.md` | Document feature |

---

## Agent Assignment Strategy

To avoid conflicts, phases will be executed with clear file ownership:

| Phase | Primary Agent | Files Touched |
|-------|--------------|---------------|
| 1 | Agent 1 | convex/* |
| 2 | Agent 1 | types/, store/, hooks/ |
| 3 | Agent 1 | StatusBadge, ScriptCard, ListView |
| 4 | Agent 2 | Kanban*.tsx (new files only) |
| 5 | Agent 1 | ViewToggle, FolderMainPanel |
| 6 | Agent 1 | QuickCreateDialog, sync testing |
| 7 | Agent 2 | KanbanSettingsDialog |
| 8-9 | Either | Testing, docs |

**Parallel opportunities**:
- Phase 3 & 4 can run in parallel (different files)
- Phase 6 & 7 can run in parallel (different files)

---

## Verification Commands

```bash
# After each phase
npx convex dev          # Check schema/functions compile
npm run lint            # Check for lint errors
npm run build           # Verify production build

# Final verification
npm run dev             # Manual testing
```

---

## Data Model Notes

### Migration Compatibility
- Scripts with `stageId: undefined` are treated as `"draft"`
- No migration script needed - handled in queries/UI
- Existing scripts continue to work unchanged

### Query Pattern
- Single query fetches all user scripts
- Client-side grouping by `stageId` (more efficient than 4 queries)
- Convex reactivity handles real-time updates automatically

### Stage Order
- `stageOrder` field uses fractional indexing
- New cards get `stageOrder = maxOrder + 1`
- Reordering calculates midpoint between adjacent cards

---

## Success Criteria

- [ ] Kanban view as third option in ViewToggle
- [ ] 4 customizable stages (Draft, In Progress, Review, Ready)
- [ ] Drag-drop between columns
- [ ] Real-time sync between all views
- [ ] StatusBadge in Grid and List views
- [ ] Quick create from columns
- [ ] Stage customization dialog
- [ ] Mobile responsive
- [ ] Dark/light mode support
- [ ] All code on `kanban` branch with clean commits
- [ ] Documentation updated in CLAUDE.md

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Schema migration | Treat undefined as "draft", no breaking changes |
| Performance with many scripts | Client-side grouping, proper indexes |
| Drag-drop on mobile | Test extensively, use dnd-kit touch sensors |
| Color accessibility | Ensure WCAG contrast, provide presets |
| Real-time sync race conditions | Convex handles atomicity, optimistic updates |

---

**Next Step**: Create `kanban` branch and begin Phase 1 implementation.
