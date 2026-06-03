# D.A.N.I.S.H

Dynamic AI Network for Intelligence, Systems & Help.

D.A.N.I.S.H is a dark, futuristic personal AI operating system built with Next.js, TypeScript, TailwindCSS, Framer Motion, ShadCN-style primitives, Supabase-ready data architecture, and provider-neutral AI route contracts.

## What Is Included

- Responsive command center dashboard
- AI Assistant, Voice Engine, Remote Control, Automation Engine, Content Factory, Study OS, Career OS, Knowledge Vault, Goals, and Notifications surfaces
- API routes for assistant messages, device commands, and automations
- Supabase schema with row-level security
- Environment template for Supabase, Gemini, and OpenAI-compatible providers
- Reusable typed data model and component structure

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On Windows PowerShell, if `npm` is blocked by script policy, use:

```bash
npm.cmd install
npm.cmd run dev
```

## Environment

Copy `.env.example` to `.env.local` and add your keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The assistant route currently falls back to a local simulator when no model key is configured. This keeps the app usable while providers are being wired.

## Supabase

Run `supabase/schema.sql` in your Supabase SQL editor. It creates:

- Profiles
- Long-term memories
- Devices and device commands
- Automations
- Goals
- Content projects
- Study assets

## Architecture Notes

Remote computer control is represented as a safe command queue. The production desktop client should be a signed Electron or Tauri app that subscribes to a Supabase Realtime channel, validates user/device permissions, executes approved commands, and writes command results back to `device_commands`.

The AI layer is intentionally provider-neutral. The `/api/assistant` route accepts a stable request shape and can be connected to Gemini, OpenAI, or any OpenAI-compatible endpoint without changing the frontend.

## Next Milestones

- Add Supabase Auth with Google login
- Connect real chat persistence and memory search
- Build the desktop device agent
- Add file upload parsing for Study OS and Knowledge Vault
- Add content generation jobs for clips, captions, thumbnails, and scripts
