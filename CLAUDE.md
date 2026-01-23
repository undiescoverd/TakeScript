# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# TakeScript

A professional tutorial script editor for SaaS companies and content creators. Replaces Google Docs for video tutorial script writing with specialized features including rich text editing, custom content blocks (chapters, screen recordings, demonstrations, editor notes), speaker attribution, version history, and focus mode.

## Development Commands

### Initial Setup
```bash
# Install dependencies
npm install

# Initialize Convex (one-time setup)
npx convex dev
# Follow prompts to create project and get NEXT_PUBLIC_CONVEX_URL

# Configure environment variables
cp .env.local.example .env.local
# Edit .env.local with Clerk and Convex credentials
```

### Development
```bash
# Terminal 1: Start Convex development server (must run first)
npx convex dev

# Terminal 2: Start Next.js development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Convex Database Operations
```bash
# Push schema changes
npx convex dev  # Automatically pushes schema on file changes

# View Convex dashboard
# Dashboard URL shown in terminal when running `npx convex dev`
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14 App Router, TypeScript, React 19, TailwindCSS 4
- **UI**: shadcn/ui (Radix UI primitives)
- **Rich Text Editor**: Tiptap with custom extensions
- **State Management**: Zustand
- **Backend/Database**: Convex (real-time sync, queries, mutations)
- **Authentication**: Clerk (Google OAuth)

### Design System & Theming

**IMPORTANT**: TakeScript uses the **Tweakcn theme** for all global styling. All new components and features must follow this color scheme.

**Color System**:
- Uses **oklch color space** for consistent, perceptually uniform colors
- Primary color: `oklch(0.6333 0.0309 154.9039)` (green accent)
- Supports light and dark modes with automatic theme switching
- All colors are defined as CSS custom properties in `app/globals.css`

**Typography**:
- Sans: **Antic** (UI elements)
- Serif: **Signifier** (content/headings)
- Mono: **JetBrains Mono** (code/editor)

**Key Design Tokens**:
- Border radius: `0.35rem`
- Shadows: Comprehensive shadow system (2xs through 2xl)
- Spacing: `0.23rem` base unit

**When creating new components**:
- Use Tailwind utility classes that reference CSS variables (e.g., `bg-card`, `text-primary`, `border-border`)
- Never use hard-coded hex colors
- Follow the existing shadcn/ui component patterns
- Ensure dark mode compatibility by using semantic color tokens

### Key Architectural Patterns

#### 1. Authentication Flow
- **Clerk** provides authentication with Google OAuth
- **ConvexProviderWithClerk** integrates Clerk auth with Convex backend
- `middleware.ts` protects all routes except `/login` and `/api`
- User identity flows: Clerk → Convex → User lookup by `tokenIdentifier`

#### 2. Convex Backend Architecture
All database operations go through Convex functions (no direct DB access):

**Query Pattern** (read data):
```typescript
// Client-side
const scripts = useQuery(api.scripts.list, {});

// convex/scripts.ts
export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    // Query database using ctx.db
  }
});
```

**Mutation Pattern** (write data):
```typescript
// Client-side
const updateScript = useMutation(api.scripts.update);
await updateScript({ scriptId, content });

// convex/scripts.ts
export const update = mutation({
  args: { scriptId: v.id("scripts"), content: v.string() },
  handler: async (ctx, args) => {
    // Validate auth and ownership
    // Update database using ctx.db.patch()
  }
});
```

**Authentication in Convex**:
All mutations/queries authenticate users via:
```typescript
const identity = await ctx.auth.getUserIdentity();
const user = await ctx.db
  .query("users")
  .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
  .unique();
```

#### 3. Tiptap Editor Integration
- **Custom Node Extensions**: `ChapterBlock`, `ScreenRecordingBlock`, `DemonstrationBlock`
- **Content Storage**: JSON stringified in Convex as `script.content`
- **Editor Initialization**: Content parsed from JSON in `ScriptEditor` component
- **Updates**: onChange → JSON.stringify → autosave hook

Custom blocks defined in `lib/tiptap/extensions.ts`:
```typescript
export const ChapterBlock = Node.create({
  name: "chapter",
  group: "block",
  content: "inline*",
  addAttributes() { /* title, duration, id */ }
});
```

**Speaker Attribution System**:
TakeScript includes a sophisticated speaker attribution system for dialogue in tutorial scripts.

- **Speaker Mark**: Tiptap Mark extension (`lib/tiptap/speaker-mark.ts`) that stores `speakerId` and `faceVisible` attributes
- **State Management**: Zustand store (`store/speaker-store.ts`) manages speaker list with colors and metadata
- **Visual Indicators**: 3px colored left border on paragraphs + clickable speaker pills
- **Keyboard Shortcuts**: Fast speaker assignment and management via keyboard

**Keyboard Shortcuts** (Cmd on Mac, Ctrl on Windows/Linux):
- **Cmd+9**: Cycle through speakers with intelligent behavior:
  - **No speakers defined**: Opens the Add Speaker dialog
  - **With selection**: Applies speaker to selected text, press again to cycle to next speaker
  - **Without selection**: Sets "pending speaker" - next typed text receives the attribution
  - **Single speaker**: Just applies that speaker
  - **Multiple speakers**: Cycles through them in order
- **Cmd+0**: Cycle camera mode (full → voiceover → corner → none)
- **Cmd+J**: Remove speaker from selection OR clear pending speaker
- **Escape**: Clear pending speaker indicator

**Pending Speaker Indicator**:
When you press Cmd+9 without a selection, a small floating badge appears near your cursor showing which speaker will be applied to your next typed text. The badge includes:
- Speaker name in their color
- Camera mode if set (e.g., "[Voiceover]")
- Pulsing dot to indicate active pending state

The pending speaker clears automatically when you:
- Type any text (the mark is applied)
- Press Escape
- Press Cmd+J
- Click outside the editor

**Slash Commands for Speakers**:
- **/speaker** or **/sp**: Assigns the first speaker to the current paragraph (no selection needed)
- Shows error toast if no speakers have been added yet

**Implementation Details**:
- Speaker marks render as `<span data-speaker-id="..." data-face-visible="...">` in the editor
- Speaker name displayed via CSS `::before` pseudo-element on paragraphs (stable, no flashing)
- Colored 3px left border indicates speaker attribution
- Edit button widget appears on hover above the speaker name
- ProseMirror node decorations add data attributes for CSS-based rendering
- Deletion cascade: Removing a speaker removes all associated marks from the document
- Face visibility toggle: Distinguish between on-camera dialogue (visible) and voiceover (VO)

**Key Files**:
- `lib/tiptap/speaker-mark.ts` - Mark extension with commands and decoration plugin
- `components/editor/SpeakerLegend.tsx` - Speaker management sidebar
- `components/editor/SpeakerEditDialog.tsx` - Edit speaker assignments dialog
- `components/editor/PendingSpeakerIndicator.tsx` - Floating indicator for pending speaker
- `store/speaker-store.ts` - Global speaker state (includes pending speaker)
- `styles/editor.css` - Speaker visual styles (lines 431-548)

#### 4. Autosave System
`hooks/use-autosave.ts` implements debounced autosave:
- **30-second delay** after last edit
- Updates `useEditorStore` with saving state
- Clears pending saves on unmount
- Manual save via `saveNow()` function

Flow:
```
Editor change → scheduleAutosave(content) → 30s timeout → save() → Convex mutation
```

#### 5. Version History
Managed in `convex/versions.ts`:
- **save**: Creates snapshot of current content with incremental version number
- **restore**: Auto-saves current state before restoring old version
- Versions sorted by `versionNumber` descending (newest first)

#### 6. State Management (Zustand)
`store/editor-store.ts` manages:
- **viewMode**: `"focus"` | `"edit"` (focus mode provides distraction-free writing)
- **sidebarOpen**: Sidebar visibility
- **versionHistoryOpen**: Version panel visibility
- **speakersOpen**: Speaker legend panel visibility
- **isSaving** / **lastSavedAt**: Autosave status

#### 7. Route Structure
```
app/
├── (auth)/
│   └── login/          # Public authentication page
├── (app)/              # Protected routes (Clerk middleware)
│   ├── dashboard/      # Script list view
│   └── script/[id]/    # Script editor (dynamic route)
├── layout.tsx          # Root layout with Providers
└── providers.tsx       # Clerk + Convex + Theme providers
```

### Data Flow

#### Script Editing Flow
```
1. User navigates to /script/[id]
2. ScriptPage queries Convex: useQuery(api.scripts.get, { scriptId })
3. Script content (JSON string) parsed to JSONContent
4. ScriptEditor initializes Tiptap with content
5. User edits → onUpdate fires → scheduleAutosave(content)
6. After 30s → useMutation(api.scripts.update) saves to Convex
7. useEditorStore updates lastSavedAt timestamp
```

#### Version Save/Restore Flow
```
Save:
1. User clicks save version button
2. useMutation(api.versions.save) called
3. Current script.content copied to scriptVersions table
4. versionNumber incremented

Restore:
1. User clicks restore on version
2. useMutation(api.versions.restore) called
3. Current content auto-saved as new version (with note)
4. script.content updated with old version content
5. ScriptPage re-queries → Editor re-initializes with restored content
```

### Database Schema (Convex)

**users**
- `tokenIdentifier` (indexed) - Links to Clerk identity
- `email`, `name`, `avatar`

**scripts**
- `userId` (indexed) - Owner reference
- `title`, `content` (JSON string), `lastEditedAt`, `createdAt`
- Index: `by_user_and_edited` for sorted listing

**scriptVersions**
- `scriptId` (indexed), `versionNumber` (indexed together)
- `content` (JSON snapshot), `changedBy`, `changeNote`, `createdAt`

**comments** (schema defined, not yet implemented)
- `scriptId`, `userId`, `content`, `position`, `resolved`, `createdAt`

### Export System

`lib/tiptap/export.ts` provides:
- **exportToPlainText()**: Converts Tiptap JSON to plain text
  - Formats chapters as `[CHAPTER TITLE]`
  - Strips all formatting
  - Used internally for word count and other text analysis
- **getWordCount()**: Counts words in document
- **getReadTime()**: Estimates read time (150 words/minute)
- **extractChapters()**: Returns array of chapter metadata for navigation

## Important Implementation Notes

### Content Synchronization
- Script content is **source of truth in Convex**
- Local state in `ScriptPage` tracks pending changes
- Version restores trigger content reload via `useEffect` watching `script?.content`
- Editor re-initializes when `initialContent` prop changes

### Custom Block IDs
Custom blocks use `id` attribute for navigation:
- Chapters need unique IDs for Beat Board / Sidebar navigation
- `handleChapterClick` scrolls to `[data-id="${chapterId}"]`
- IDs should be generated on block creation

### Authentication Ownership Pattern
All Convex mutations follow this pattern:
```typescript
1. Get user identity from Clerk via ctx.auth.getUserIdentity()
2. Look up user in database via tokenIdentifier index
3. Verify resource ownership (e.g., script.userId === user._id)
4. Perform operation
```

### Provider Nesting Order
Critical order in `app/providers.tsx`:
```
ClerkProvider → ConvexProviderWithClerk → ThemeProvider
```
Convex needs Clerk's `useAuth` hook to sync authentication.

### Slash Command Integration
SlashCommandMenu component should:
- Listen for "/" key in editor
- Show menu with block type options
- Insert custom blocks via Tiptap commands:
  ```typescript
  editor.chain().focus().insertContent({ type: 'chapter', attrs: { ... } }).run()
  ```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Clerk redirect URLs configured via environment variables (see `.env.local.example`).

## Testing Development Environment

```bash
# Start both servers
npx convex dev    # Terminal 1 (must start first)
npm run dev       # Terminal 2

# Test flow:
1. Visit http://localhost:3000
2. Redirect to /login (unauthenticated)
3. Sign in with Google OAuth (Clerk)
4. Redirect to /dashboard
5. Create new script → opens /script/[id]
6. Test editor, autosave, custom blocks
7. Check Convex dashboard for data persistence
```

## Key Files Reference

**Core Application**:
- `app/(app)/script/[id]/page.tsx` - Main editor page with autosave
- `components/editor/ScriptEditor.tsx` - Tiptap integration
- `hooks/use-autosave.ts` - Debounced save logic

**Backend**:
- `convex/schema.ts` - Database schema
- `convex/scripts.ts` - CRUD operations for scripts
- `convex/versions.ts` - Version save/restore logic

**Editor Extensions**:
- `lib/tiptap/extensions.ts` - Custom block definitions
- `lib/tiptap/export.ts` - Export utilities

**State**:
- `store/editor-store.ts` - Global editor state (Zustand)

**Authentication**:
- `middleware.ts` - Route protection
- `app/providers.tsx` - Auth provider setup
