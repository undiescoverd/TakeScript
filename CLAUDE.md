# CLAUDE.md
Guidance for Claude Code when working with this repository.

# TakeScript
Professional tutorial script editor for SaaS companies. Replaces Google Docs with rich text editing, custom content blocks, speaker attribution, recording/focus modes, version history, and teleprompter export.

## Quick Start
```bash
npm install
npx convex dev              # Terminal 1 (must start first)
npm run dev                 # Terminal 2
```

## Tech Stack
- **Frontend**: Next.js 14 App Router, TypeScript, React 19, TailwindCSS 4
- **UI**: shadcn/ui, Radix UI primitives
- **Editor**: Tiptap with custom extensions
- **State**: Zustand
- **Backend**: Convex (real-time sync, metadata)
- **Storage**: Cloudflare R2 (script content, S3-compatible)
- **Auth**: Clerk (Google OAuth)

## Design System
**CRITICAL**: Use Tweakcn theme throughout.
- **Colors**: oklch color space, primary `oklch(0.6333 0.0309 154.9039)` (green)
- **Typography**: Antic (UI), Signifier (content), JetBrains Mono (code)
- **Design Tokens**: Border radius `0.35rem`, spacing `0.23rem`
- **Rules**: Use CSS variables (`bg-card`, `text-primary`) NOT hex colors. Support light/dark modes.

## Architecture

### Authentication Flow
Clerk → ConvexProviderWithClerk → Convex backend
- `middleware.ts` protects all routes except `/login` and `/api`
- User lookup: `ctx.auth.getUserIdentity()` → query by `tokenIdentifier`

### Convex Backend
All DB operations via Convex functions:
```typescript
// Query (read)
const scripts = useQuery(api.scripts.list, {});

// Mutation (write)
const update = useMutation(api.scripts.update);
await update({ scriptId, content });

// Auth pattern (all mutations/queries)
const identity = await ctx.auth.getUserIdentity();
const user = await ctx.db.query("users")
  .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
  .unique();
```

### Tiptap Editor
**Custom Blocks** (3 types):
1. **Chapter** - Title + duration + ID for navigation
2. **Screen Recording** - MonitorPlay icon, blue theme
3. **Animation** - Sparkles icon, orange theme

**Implementation**:
- Content stored as JSON string in `script.content`
- Custom blocks defined in `lib/tiptap/extensions.ts`
- Slash commands insert blocks: `editor.chain().focus().insertContent({ type: 'chapter', attrs: {...} }).run()`

**Speaker Attribution**:
- Mark extension: `lib/tiptap/speaker-mark.ts` stores `speakerId`, `faceVisible`
- State: Zustand store `store/speaker-store.ts`
- Visual: 3px colored left border + speaker pills
- Shortcuts: Cmd+1-4 (assign speakers), Cmd+J (remove), Cmd+0 (cycle camera mode)
- Slash: `/speaker` or `/sp` assigns first speaker to paragraph
- CSS renders via `::before` pseudo-element (stable, no flash)
- Decorations add data attributes for CSS targeting

**Key Files**:
- `lib/tiptap/speaker-mark.ts` - Mark extension
- `components/editor/SpeakerLegend.tsx` - Speaker sidebar
- `store/speaker-store.ts` - Global speaker state

### Autosave System
`hooks/use-autosave.ts`: 2s debounced save to R2
```
Editor change → scheduleAutosave() → 2s delay → save() → R2 upload → Convex metadata update
```

### R2 Storage (Content)
Script content stored in Cloudflare R2 for cost efficiency (~$5/month vs $25/month).
- **Save**: `convex/scripts.ts::updateWithR2` action uploads to R2, stores URL in Convex
- **Load**: `convex/scripts.ts::loadWithContent` action fetches from R2 when `contentUrl` exists
- **Utilities**: `lib/r2-storage.ts` - S3-compatible client using AWS SDK
- **Actions**: `convex/r2.ts` - Convex action wrappers for R2 operations
- **Migration**: `convex/migration.ts` - Scripts to migrate existing content

### Version History
`convex/versions.ts`:
- **save**: Snapshot with incremental `versionNumber`
- **restore**: Auto-saves current before restoring old version

### State Management (Zustand)
`store/editor-store.ts`:
- **viewMode**: `"focus"` | `"edit"` (Focus Mode toggle)
- **mode**: `"editing"` | `"recording"` (hides UI in recording)
- **sidebarOpen**: Sidebar visibility
- **versionHistoryOpen**: Version panel
- **isSaving** / **lastSavedAt**: Autosave status

### Focus Mode
New distraction-free editing experience:
- Toggle via Cmd+Shift+F or ViewModeToggle in Topbar
- **Features**:
  - Auto-hide topbar (shows on hover)
  - BeatBoard hover reveal (hidden by default)
  - `data-view-mode` attribute on page for CSS targeting
- **Implementation**: `store/editor-store.ts` manages `viewMode` state
- **Styling**: `styles/editor.css` contains focus-mode specific CSS

## Database Schema (Convex)
**users**: `tokenIdentifier` (indexed), `email`, `name`, `avatar`
**scripts**: `userId` (indexed), `title`, `content` (deprecated), `contentUrl` (R2), `contentSize`, `lastEditedAt`, `createdAt`
**scriptVersions**: `scriptId`, `versionNumber`, `content` (deprecated), `contentUrl` (R2), `changedBy`, `changeNote`, `createdAt`
**comments**: Schema defined, not implemented

## Export System
`lib/tiptap/export.ts`:
- **exportToPlainText()**: Tiptap JSON → plain text (chapters as `[TITLE]`)
- **getWordCount()**: Count words
- **getReadTime()**: Estimate (150 words/min)
- **extractChapters()**: Extract chapter metadata

## Routes
```
app/
├── (auth)/login/          # Public
├── (app)/                 # Protected by Clerk
│   ├── dashboard/         # Script list
│   └── script/[id]/       # Editor
├── layout.tsx             # Root + Providers
└── providers.tsx          # Clerk + Convex + Theme
```

## Critical Patterns

### Provider Nesting Order
**MUST** follow this order in `app/providers.tsx`:
```
ClerkProvider → ConvexProviderWithClerk → ThemeProvider
```

### Authentication Ownership
All Convex mutations:
1. Get identity: `ctx.auth.getUserIdentity()`
2. Lookup user via `tokenIdentifier` index
3. Verify ownership (e.g., `script.userId === user._id`)
4. Perform operation

### Content Sync
- Convex is source of truth
- Local state tracks pending changes
- Version restore triggers re-query
- Editor re-initializes on `initialContent` change

### Custom Block Navigation
- Blocks need unique `id` attribute
- Beat Board/Sidebar scrolls to `[data-id="${chapterId}"]`
- IDs generated on creation via `generateBlockId()`

## Environment Variables
```bash
# Convex & Clerk
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Cloudflare R2 (set in Convex dashboard AND .env.local)
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=takescript-content
```

## Key Files
**Core**:
- `app/(app)/script/[id]/page.tsx` - Main editor + autosave
- `components/editor/ScriptEditor.tsx` - Tiptap integration
- `hooks/use-autosave.ts` - Debounced save to R2

**Backend**:
- `convex/schema.ts` - DB schema
- `convex/scripts.ts` - CRUD operations + R2 loading
- `convex/versions.ts` - Version control
- `convex/r2.ts` - R2 action wrappers
- `convex/migration.ts` - R2 migration scripts
- `lib/r2-storage.ts` - R2 S3-compatible client

**Editor**:
- `lib/tiptap/extensions.ts` - Custom blocks (Chapter, ScreenRecording, Animation)
- `lib/tiptap/speaker-mark.ts` - Speaker attribution
- `lib/tiptap/export.ts` - Export utilities
- `lib/tiptap/slash-commands.ts` - Slash command menu

**State**:
- `store/editor-store.ts` - Editor state (viewMode, mode, sidebar, saving)
- `store/speaker-store.ts` - Speaker management

**UI**:
- `components/layout/Topbar.tsx` - Top bar with ViewModeToggle
- `components/editor/BeatBoard.tsx` - Chapter navigation sidebar
- `components/editor/SpeakerLegend.tsx` - Speaker management

**Styles**:
- `app/globals.css` - Global styles + Tweakcn theme
- `styles/editor.css` - Editor-specific styles + focus mode
