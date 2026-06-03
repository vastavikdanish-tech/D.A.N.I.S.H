# D.A.N.I.S.H - Quick Reference Guide

## 🚀 Getting Started

### 1. Apply Database Schema (REQUIRED)
```bash
# In Supabase Console:
# 1. Open your project
# 2. Go to SQL Editor
# 3. Paste contents of supabase/schema.sql
# 4. Click "Run"
```

### 2. Configure Environment
```bash
# .env.local must have:
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
GEMINI_API_KEY=AIzaSyxxx
GEMINI_API_URL=https://generativelanguage.googleapis.com
```

### 3. Start Development Server
```bash
npm run dev
# Runs on http://localhost:3000
```

---

## 📊 Database Structure

### Core Tables (18 total)

**Authentication & Profiles:**
- `users` - Mirror of auth.users
- `profiles` - User profile data (name, avatar, timezone)

**Memory & Knowledge:**
- `memories` - Personal, study, career memories (with shared_with array)
- `relationship_memories` - Shared memories between partners

**Relationships:**
- `relationship_goals` - Shared goals between two users
- `shared_space` - Shared container for couple data

**Tracking:**
- `health_tracking` - Sleep, food, water, mood, notes
- `sleep_tracking` - Detailed sleep data
- `mood_tracking` - Mood logs with intensity
- `study_tracking` - Study sessions and subjects

**Reminders & Notifications:**
- `reminders` - Owner or shared reminders

**Devices & Automation:**
- `devices` - Device registry
- `device_commands` - Command queue (queued, running, succeeded, failed)
- `automations` - Workflow/trigger automation
- `goals` - Personal goals
- `content_projects` - Content ideas/projects
- `study_assets` - Study notes, flashcards, etc.

---

## 🔐 Security Model

### Row Level Security (RLS)
- **Owner-only:** profiles, users, devices, health_tracking, sleep_tracking, mood_tracking, study_tracking, automations, goals, content_projects, study_assets
- **Shared:** memories (via shared_with array), reminders (via shared_with), relationship_memories (owner OR partner), relationship_goals (owner OR partner), shared_space (user_a OR user_b)

### All policies use:
```sql
auth.uid() = user_id  -- or other matching fields
```

### Client Sends:
```
Authorization: Bearer <access_token>
```

### Server Resolves:
```typescript
const userId = await getUserIdFromRequest(request);
```

---

## 📡 API Endpoints

### Authentication
```
POST /api/auth
{
  "action": "signup|login",
  "email": "user@example.com",
  "password": "secure_password"
}
Returns: { user: { id, email }, session: { access_token } }
```

### Memories
```
GET /api/memories?category=personal|study|relationship|goal|conversation|note|career|preference|project
POST /api/memories
{
  "title": "string",
  "body": "string",
  "category": "personal|study|...",
  "shared_with": ["uuid1", "uuid2"],
  "tags": ["tag1", "tag2"]
}
```

### Assistant
```
POST /api/assistant
{
  "message": "What are my goals?",
  "mode": "assistant"
}
Returns: { content: "...", memories_loaded: N }
```

### Relationship Features
```
POST /api/relationship_goals
{
  "title": "Learn piano",
  "description": "Both of us learn piano",
  "partner_id": "uuid",
  "due_date": "2026-12-31"
}

GET /api/relationship_goals
POST /api/shared_space
{
  "partner_id": "uuid",
  "name": "Our space"
}
```

### Health Tracking
```
POST /api/health
{
  "date": "2026-06-02",
  "sleep_hours": 8,
  "water_ml": 2000,
  "mood": "happy|sad|neutral|anxious",
  "notes": "Great day!"
}

GET /api/health?date=2026-06-02
```

### Reminders
```
POST /api/reminders
{
  "title": "Meditate",
  "body": "Daily meditation",
  "remind_at": "2026-06-02T08:00:00Z",
  "recurring": "daily|weekly|monthly",
  "shared": false,
  "shared_with": []
}

GET /api/reminders
```

### Devices
```
POST /api/devices
{
  "deviceId": "uuid",
  "action": "open_app",
  "payload": { "app": "Slack" }
}
```

---

## 💾 Memory Categories

| Category | Purpose | Shared | Example |
|----------|---------|--------|---------|
| personal | Private thoughts | No | "Don't forget to call mom" |
| study | Learning notes | Optional | "React hooks explained" |
| relationship | Couple data | Yes (auto) | "Our anniversary is March 15" |
| goal | Objective tracking | Optional | "Run a marathon by 2027" |
| conversation | Chat history | Auto-saved | "User: What's my weight?" |
| note | Quick notes | Optional | "Meeting notes" |
| career | Job tracking | Optional | "Applied to 3 companies" |
| preference | Settings/preferences | Optional | "Prefer dark mode" |
| project | Projects | Optional | "Building D.A.N.I.S.H" |

---

## 🤖 AI Assistant Features

### Loaded Context
- Fetches last 6 memories (owned OR shared with user)
- Formatted as: `{ category, title, body }`
- Included in system prompt to Gemini

### Model Fallback (in priority order)
1. gemini-2.5-flash
2. gemini-2.5-flash-lite
3. gemini-2.0-flash
4. gemini-2.0-flash-lite
5. gemini-3.1-flash-lite

### Response Flow
1. Load memory context
2. Call Gemini API
3. Save user message as "conversation" memory
4. Save assistant response as "conversation" memory
5. Return response to client

---

## ✅ Validation & Error Handling

### All Routes Validate:
- ✅ User is authenticated
- ✅ Required fields present
- ✅ UUID format correct (regex)
- ✅ Array elements are valid UUIDs
- ✅ Enums match allowed values
- ✅ No self-references (e.g., user can't create goal with themselves)

### Error Responses:
```
400 - Bad Request (validation failed)
401 - Unauthenticated (no token)
500 - Server Error (DB/API error)
```

---

## 🧪 Testing Checklist

### Before Launch:
- [ ] Schema created in Supabase (18 tables)
- [ ] Signup creates user + profile
- [ ] Login returns access token
- [ ] Memory save works (personal)
- [ ] Memory share works (relationship)
- [ ] Assistant loads memories + calls Gemini
- [ ] Health tracking persists
- [ ] Reminders queryable
- [ ] Relationship goals accessible by both users
- [ ] Non-partner can't access relationship data

### With Multiple Users:
- [ ] User A creates relationship memory for User B
- [ ] User B can view it (RLS policy)
- [ ] User C cannot view it (RLS policy)
- [ ] Shared goals visible to both
- [ ] Shared space members both access

---

## 📈 Production Readiness

**Current Status:** 78%

**To Get to 90% (do this first):**
1. ✅ Run schema.sql
2. ✅ Test auth flow
3. ✅ Test memory save/recall
4. ✅ Test with 2 users (relationship features)
5. ✅ Set up monitoring

**To Get to 100%:**
6. Implement reminder scheduler
7. Add email notifications
8. Set up vector embeddings
9. Configure real-time sync
10. Load test at scale

---

## 📚 Documentation

- [FINAL_AUDIT_REPORT.md](./FINAL_AUDIT_REPORT.md) - Comprehensive audit
- [VERIFICATION_CHECKLIST.md](./VERIFICATION_CHECKLIST.md) - Verification tests
- [supabase/schema.sql](./supabase/schema.sql) - Full database schema

---

## 🔧 Common Tasks

### Reset Local Database
```sql
-- In Supabase SQL Editor:
DROP TABLE IF EXISTS public.study_assets CASCADE;
DROP TABLE IF EXISTS public.content_projects CASCADE;
-- ... repeat for all tables ...
-- Then re-run schema.sql
```

### Debug Memory Query
```
GET /api/memories
-- Returns all memories owned or shared with user
```

### Test Gemini Integration
```bash
node test-gemini.mjs
# Requires .env.local with GEMINI_API_KEY
```

### Type Check
```bash
npm run typecheck
# Should pass with 0 errors
```

---

## 🚨 Known Limitations

1. **Reminder Scheduling:** No cron/scheduler implemented (needs external service)
2. **Real-time Sync:** No client-side subscriptions (needs Supabase Realtime setup)
3. **Vector Search:** Embedding columns defined but not used yet
4. **Email:** Auth sends email confirm, but email provider not configured
5. **Pagination:** Limited to top N results (no offset/cursor)

---

## 📞 Support

**For errors, check:**
1. .env.local has all required keys
2. Supabase schema.sql has been run
3. TypeScript: `npm run typecheck`
4. Browser console for client errors
5. Supabase logs in SQL Editor

**Common issues:**
- "Unauthenticated" → Token missing or expired
- "Missing or invalid userId" → Auth header not sent
- Foreign key error → UUID format incorrect
- Type error on insert → Column type mismatch

---

**Last Updated:** June 2, 2026
