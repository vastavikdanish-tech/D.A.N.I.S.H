# PHASE 2 PLAN — Safe improvements (no changes to working: voice, Gemini, assistant, memory, auth, existing API routes)

## Goal
Complete partially implemented UI/feature surfaces using the existing backend/API and current architecture. Add scheduling UI, loading/empty/error states, and ensure navigation leads to functional screens—without touching working assistant/memory/auth/voice/Gemini/Supabase logic.

## Scope: What we will NOT change (to avoid regressions)
- `app/api/assistant/route.ts` (Gemini tool/function calling + memory persistence)
- `lib/ai.ts` (Gemini integration + tool definitions)
- `app/api/memories/route.ts` (memory system)
- `app/api/auth/route.ts` (authentication)
- Any existing device/automation API behavior
- Any voice assistant logic inside `components/command-center.tsx` (wake word + speech recognition/TTS)

## Likely “phase 2” targets (based on current UI inspection)
1. **Dashboard usability**
   - Connect buttons that currently fire placeholder/mock actions to real API calls (only UI-level wiring; no backend changes).
2. **Loading / error / empty states**
   - Add consistent UI feedback for memory load, assistant send, automations create, device command submit, etc.
3. **Reminder scheduling UI**
   - Add a reminder surface to the dashboard (UI only) that calls existing `/api/reminders` endpoints (GET/POST).
   - Do not implement backend cron/scheduler yet (explicitly out of scope for “safe improvements”).
4. **Mobile responsiveness**
   - Ensure panels stack properly on smaller screens.
5. **Avoid “fake demos”**
   - Replace purely visual placeholders with minimal real functionality where APIs already exist.

## Batch plan (small batches)
### Batch A — Reminder Scheduling UI (UI wiring only)
- Add a Reminder panel inside the command center (or an appropriate dashboard card).
- Implement:
  - GET reminders on load
  - POST new reminder from a form
  - Loading state + empty state + error state
- Backend touched: **NO**
- Expected benefit: makes an existing-but-partial feature actually usable.

### Batch B — Dashboard wiring + improved UX states
- Identify any buttons/links that currently do nothing or rely on mocks.
- Add:
  - disabled states while requests are in-flight
  - error banners/toasts (lightweight, no global refactor)
  - empty states for each panel
- Backend touched: **NO**

### Batch C — Navigation completeness
- Ensure “menu items” lead to real sections or routes (no new routes unless needed).
- Backend touched: **NO**

## Files to modify (estimated)
(Exact list will be confirmed after reading current UI files in this repo.)
- `components/command-center.tsx` (high probability: where dashboard panels live)
- Potentially: `components/ui/*` for minor reusable UI primitives (low probability; only if needed)

## Risk level
**Low to Medium overall**, with highest risk in `components/command-center.tsx` due to its large size and voice code presence.
Mitigation: do not touch voice/Gemini/memory/auth logic blocks; only add new components or isolate changes to new reminder panel code paths.

## Expected user benefit
- Reminder scheduling becomes functional (UI -> `/api/reminders`).
- Better dashboard usability and reliability via loading/error/empty states.
- Fewer confusing “dead” buttons and improved mobile experience.

## Rollback instructions (for each batch)
- Revert only the files modified in the batch using git:
  - `git checkout -- <file>` for each changed file
- Since we do not plan backend changes, API regression risk is minimal.
