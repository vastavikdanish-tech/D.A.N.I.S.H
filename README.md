# D.A.N.I.S.H - Personal AI Operating System

Dynamic AI Network for Intelligence, Systems & Help. D.A.N.I.S.H is a personal AI operating system with voice control, PWA support, Android companion, and device control agents.

## What It Is

D.A.N.I.S.H is a full-stack personal AI OS that combines:
- A Next.js web dashboard with voice-enabled AI assistant
- Progressive Web App (PWA) for mobile browser install
- Android companion app with local agent capabilities
- Windows device control agent for local machine automation
- Voice service powered by edge-tts for natural speech
- System controller for executing device commands
- Supabase backend for persistence, auth, and real-time sync
- Gemini AI for intelligent assistant responses and embeddings
- Memory system with vector search (3072-dim embeddings)

## Quick Start

### Prerequisites

- Node.js 18+ (npm 9+)
- Python 3.10+
- A Supabase account (free tier works)
- A Google Gemini API key

### Setup

1. Clone the repository and install dependencies:

```bash
npm install
pip install -r voice-service/requirements.txt
pip install fastapi uvicorn edge-tts pyautogui
```

2. Copy the environment template and fill in your keys:

```bash
cp .env.example .env.local
```

3. Run the Supabase schema (`supabase/schema.sql`) in your Supabase SQL editor to create all tables and RLS policies.

4. Launch all services:

```powershell
.\start.ps1
```

This starts the Next.js dev server (port 3000), the voice service (port 8765), and the system controller (port 8766).

## Environment Variables

All environment variables are defined in `.env.example` and should be copied to `.env.local`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) |
| `OPENAI_API_KEY` | OpenAI API key (optional, for fallback) |
| `GEMINI_API_KEY` | Google Gemini API key for assistant and embeddings |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app (default: http://localhost:3000) |

## Launching All Services

Run the startup script from the project root:

```powershell
.\start.ps1
```

Options:
- `-NoVoice` - Skip starting the voice service
- `-NoController` - Skip starting the system controller
- `-NoDev` - Skip starting the Next.js dev server

## Architecture Overview

```
                         +------------------+
                         |   Web Browser    |
                         |  (PWA capable)   |
                         +--------+---------+
                                  |
                    +-------------+-------------+
                    |      Next.js (Vercel)     |
                    |  - App Router / API       |
                    |  - Assistant route        |
                    |  - Device command route   |
                    |  - Automation route       |
                    +-------------+-------------+
                                  |
         +------------------------+------------------------+
         |                        |                        |
+--------+--------+     +---------+--------+     +--------+--------+
|   Supabase      |     |   Voice Service  |     | System          |
|  - PostgreSQL   |     |   (edge-tts)     |     | Controller      |
|  - Auth         |     |   Port 8765      |     | Port 8766       |
|  - Realtime     |     +------------------+     +--------+--------+
|  - Vector store |                                          |
+-----------------+                               +---------+---------+
                                                  | Device Agents     |
                                                  | (Windows, Android)|
                                                  +-------------------+
```

- **Frontend**: Next.js 15 with TypeScript, TailwindCSS, Framer Motion, ShadCN-style components
- **Backend**: Supabase (Postgres + Auth + Realtime + pgvector)
- **AI**: Google Gemini for chat completion and text embeddings (3072-dim)
- **Voice**: Python edge-tts service for text-to-speech
- **Device Control**: Python system controller + platform-specific agent scripts
- **Mobile**: Android companion app (Gradle-based) with local agent

## Project Structure

| Path | Description |
|---|---|
| `app/` | Next.js App Router pages and API routes |
| `components/` | React UI components (shell, modules, auth, PWA) |
| `lib/` | Shared utilities and client libraries |
| `types/` | TypeScript type definitions |
| `public/` | Static assets, PWA icons, service worker |
| `supabase/` | Database schema and migrations |
| `voice-service/` | Python edge-tts voice service |
| `system-controller/` | Python device command executor |
| `agents/` | Platform-specific agent scripts (Windows, Android) |
| `android/` | Android companion app source |
| `scripts/` | Utility scripts (icon generation, database seeding) |
| `data/` | Data files and configuration |
| `start.ps1` | PowerShell launcher for all services |

## Development Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Lint with Next.js ESLint config |
| `npm run typecheck` | Run TypeScript type checking |
| `node scripts/seed.mjs` | Seed test data into the database |
| `.\start.ps1` | Launch all services concurrently |

## Deployment

### Web (Vercel)

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Set all environment variables from `.env.local` in Vercel's dashboard.
4. Deploy. The `vercel.json` or Next.js config handles the build settings automatically.

### Android APK

1. Open `android/` in Android Studio.
2. Update `local.properties` with your SDK path (use `local.properties.template` as reference).
3. Build the APK via Build > Build Bundle(s) / APK(s) > Build APK.
4. The unsigned APK will be at `android/app/build/outputs/apk/debug/`.

## License

MIT - see [LICENSE](./LICENSE).
