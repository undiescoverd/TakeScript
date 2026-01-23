# TakeScript

A professional tutorial script editor designed for SaaS companies and content creators who produce tutorial videos. TakeScript replaces Google Docs for script writing by providing specialized features for video production workflows.

## Features

- **Rich Text Editor** - Professional screenplay-style formatting with Tiptap
- **Custom Blocks** - Chapters, Screen Recording sections, Demonstrations, and Editor Notes
- **Speaker Attribution** - Assign dialogue to different speakers with visual indicators
- **Version History** - Save and restore previous versions of your scripts
- **Real-time Autosave** - Never lose your work
- **Beat Board** - Visual timeline of chapters
- **Dark/Light Mode** - Professional appearance in any environment

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI)
- **Editor**: Tiptap (rich text)
- **State Management**: Zustand
- **Backend/Database**: Convex (real-time sync)
- **Authentication**: Clerk (Google OAuth)
- **Deployment**: Vercel + Convex

## Getting Started

### Prerequisites

- Node.js 18+
- A [Clerk](https://clerk.com) account
- A [Convex](https://convex.dev) account

### Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd takescript
npm install
```

2. Create a Clerk application:
   - Go to [clerk.com](https://clerk.com) and create a new application
   - Enable Google OAuth
   - Copy your Publishable Key and Secret Key

3. Create a Convex project:
   - Go to [convex.dev](https://convex.dev) and create a new project
   - Copy your Convex URL

4. Configure environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your actual values:
```env
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

5. Start the Convex development server:
```bash
npx convex dev
```

6. In a separate terminal, start the Next.js development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
takescript/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth routes (login)
│   ├── (app)/             # Protected app routes
│   │   ├── dashboard/     # Script list
│   │   └── script/[id]/   # Script editor
│   ├── layout.tsx         # Root layout with providers
│   └── providers.tsx      # Clerk + Convex + Theme providers
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── editor/            # Tiptap editor components
│   ├── dashboard/         # Dashboard components
│   ├── layout/            # Navigation components
│   └── versions/          # Version history components
├── convex/                # Convex backend
│   ├── schema.ts          # Database schema
│   ├── scripts.ts         # Script CRUD operations
│   ├── users.ts           # User management
│   └── versions.ts        # Version history
├── lib/
│   ├── tiptap/            # Tiptap extensions and utilities
│   └── utils.ts           # Helper functions
├── hooks/                 # Custom React hooks
└── store/                 # Zustand stores
```

## Custom Block Types

TakeScript includes specialized blocks for tutorial scripts:

- **Chapter** (`/chapter`) - Major sections with titles
- **Screen Recording** (`/screen`) - Sections for screen recording cues
- **Demonstration** (`/demonstration`) - Live demonstration markers
- **Editor Note** (`/note`) - Notes hidden in recording mode

## Keyboard Shortcuts

- `Ctrl/Cmd + S` - Save version
- `Ctrl/Cmd + P` - Export for PrompSmart
- `/` - Open slash command menu

## Deployment

### Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add your environment variables
4. Deploy

### Convex

Convex deploys automatically when you push to production. Configure your Convex project to use your production environment.

## License

MIT
