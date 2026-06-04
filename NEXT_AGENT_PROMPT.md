# Next Agent Prompt

You are the next AI agent continuing development of D.A.N.I.S.H, a Personal AI Operating System project.

## Critical First Steps

1. Read `AI_HANDOFF.md` first.
2. Read `PROJECT_STATUS.md` second.
3. Verify the current Git status and do not assume the worktree is clean.
4. Confirm whether the handoff commit exists.
5. Continue only from the recommended next batch unless the user gives a different instruction.

## Important Context

The previous AI already performed repository analysis and created the Phase 1 project audit. Do not repeat the full audit. Do not re-audit already documented systems unless a specific file changed or the user asks.

Development was temporarily stopped so this handoff could be created. Do not implement new features until the user explicitly asks you to continue.

## Stable Systems To Protect

Never break or casually refactor these systems:

- Voice Assistant
- Wake-word logic
- Speech recognition and TTS
- AI Assistant
- Gemini Integration
- Memory System
- Authentication
- Supabase Integration
- Existing API routes
- Existing database tables
- Existing device command queue contract
- Existing environment variables

Do not modify these files without explicit user approval:

- `.env.local`
- `lib/ai.ts`
- `app/api/assistant/route.ts`
- `app/api/auth/route.ts`
- `app/api/memories/route.ts`
- `components/auth-provider.tsx`
- `components/auth-gate.tsx`
- `lib/auth.ts`
- `lib/supabase.ts`
- `lib/supabase.server.ts`
- `supabase/schema.sql`

## Current Completed Work

Phase 1 is complete:

- `PROJECT_STATUS.md` exists and contains the project audit.

Phase 2 is substantially complete in the safe UI/API-wiring scope:

- Reminder panel wired to existing `/api/reminders`.
- Dashboard loading/empty/error/success states improved.
- Automation panel wired to existing `/api/automations`.
- Remote actions wired to existing `/api/devices`.
- System device panel wired to existing `/api/devices`.
- Sidebar and mobile navigation point to real sections.

Do not repeat this work.

## Verification Known So Far

Previously verified:

- `npm run typecheck` passed.
- `npm run lint` completed with one existing warning in `lib/ai.ts`.

Known issue:

- `npm run build` failed with a `.next` readlink error on OneDrive:

```text
EINVAL: invalid argument, readlink '...\D.A.N.I.S.H\.next\server\app-paths-manifest.json'
```

Do not treat that as proof of a TypeScript/app-code failure. If build verification is needed, ask before deleting/regenerating `.next`.

## How To Continue

Work in small batches.

After every completed batch:

1. Test it.
2. Save it.
3. Commit it.
4. Report:
   - files changed
   - features completed
   - verification performed
   - rollback instructions
5. Stop and wait for user approval before the next batch.

Never do large architecture refactors.
Never remove code just because it looks old or static.
Never replace working functionality.
Always improve incrementally.

## Recommended Next Phase

Start with **Phase 3 - User Profile System**, batch 1.

Safest first Phase 3 batch:

1. Read the current `profiles` table in `supabase/schema.sql`.
2. Add only a minimal profile read/update route if needed.
3. Add a small profile settings UI using existing auth/session context.
4. Store user display name/timezone only if schema already supports it.
5. Replace one safe greeting display with profile data.
6. Do not modify wake-word logic or all hardcoded "Danish" references in one pass.

Why this is next:

- It unlocks dynamic greetings.
- It begins removal of hardcoded user references.
- It supports future smart dashboard suggestions.
- It is safer than jumping into device agents or APK work.

## Explicit Non-Goals For The Next Batch

Do not implement:

- Device agent architecture.
- Windows command execution.
- Android Accessibility integration.
- Remote desktop.
- APK packaging.
- Full AI orchestration rewrite.
- Supabase schema rewrite.
- Gemini prompt/tool redesign.
- Full dashboard redesign.

## Roadmap Estimates From Previous AI

- Overall completion: 24%
- Backend completion: 42%
- Frontend completion: 34%
- AI completion: 48%
- Device control completion: 12%
- APK readiness: 8%

Estimated remaining phases: 12 major phases.

## Final Reminder

Assume the current AI already inspected the repository. Your job is continuity, not rediscovery. Read the handoff, verify the current state, then continue from the smallest safe next batch approved by the user.
