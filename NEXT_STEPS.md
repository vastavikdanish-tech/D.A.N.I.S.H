# Next Steps — Highest-Priority Remaining Features

Ordered by impact vs. effort.

---

## 1. Push Notifications for Reminders 🔴

**Why**: Reminders API works, but users never get notified. The #1 broken promise.

**What**:
- Server-side poller checking `remind_at` every 60s
- Web Push API via Service Worker
- Browser notification permission request during onboarding

**Files**: New `app/api/notifications/route.ts`, new `public/sw.js`, modify `onboarding.tsx`

**Est**: 2–3 days

---

## 2. Real Device Integration 🔴

**Why**: Device schema + API exist but only return mock data.

**What**:
- Device registration flow (add device via UI)
- Real command execution (at minimum: mock execution with simulated states)
- Device status live updates

**Est**: 3–5 days

---

## 3. Real Automation Execution 🔴

**Why**: Automation schema + API exist but automations never trigger.

**What**:
- Server-side scheduler/cron checking automation triggers
- Execute automation steps sequentially
- Log execution results to `device_commands.result`

**Est**: 3–5 days

---

## 4. Studio/Career/Study API Integration 🟡

**Why**: Schemas exist (`study_tracking`, `study_assets`, `goals`, `content_projects`) but have no APIs.

**What**:
- Create `/api/study` with GET/POST for study_tracking and study_assets
- Create `/api/goals` with GET/POST for goals table
- Create `/api/content` with GET/POST for content_projects
- Wire into dashboard panels (replace mock data)

**Est**: 4–6 days

---

## 5. Memory System Improvements 🟡

**Why**: Memories are the core AI knowledge store but have gaps.

**What**:
- `DELETE /api/memories/[id]` — memory deletion
- `GET /api/memories?q=search` — text search endpoint
- Memory importance slider in UI
- Memory categories dropdown filter

**Est**: 2–3 days

---

## 6. Profile Picture Upload 🟡

**Why**: Schema supports `avatar_url`, UI says "coming soon".

**What**:
- File upload endpoint (`/api/upload`) → Supabase Storage
- Avatar crop/resize client-side
- Wire to profile PATCH

**Est**: 2 days

---

## 7. Real-Time Dashboard Updates 🟡

**Why**: Dashboard data is static/mock. No live feel.

**What**:
- SSE or WebSocket connection for live metrics
- Auto-refresh reminders, memory count, device status
- Replace hardcoded knowledge blocks with real queries

**Est**: 3–4 days

---

## 8. Forgot Password / Email Reset 🟡

**Why**: Auth works but has no recovery flow.

**What**:
- Supabase built-in password reset email
- Reset password page UI
- Link on login form

**Est**: 1 day

---

## 9. Multi-Language UI 🟢

**Why**: AI supports Hindi/Hinglish but UI is English-only.

**What**:
- i18n library (next-intl or similar)
- Language switcher in settings
- Translated UI strings

**Est**: 3–4 days

---

## 10. PWA / Offline Support 🟢

**Why**: No mobile app, no offline.

**What**:
- Service worker with cache-first strategy
- Web manifest
- Offline fallback page

**Est**: 2–3 days
