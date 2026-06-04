# Phase 3 Execution Plan

**Date**: 2026-06-04
**Status**: Planning - Awaiting Approval

---

## What Already Exists

| Feature | Status | Location |
|---------|--------|----------|
| `profiles` table | ✅ Exists | `supabase/schema.sql:18-26` |
| Profile fields | ✅ `display_name`, `avatar_url`, `timezone`, `bio` | Schema |
| Auth context | ✅ `useAuth()` provides `user` | `components/auth-provider.tsx` |
| Auth fetch helper | ✅ `authFetch` in CommandCenter | `components/command-center.tsx:209` |
| ProfileSummary component | ✅ Shows email-derived name | `components/command-center.tsx:360` |
| HeroCommand greeting | ⚠️ Uses email or "Danish" fallback | `components/command-center.tsx:384` |
| Voice wake-word | ⚠️ Uses "Hello Danish" | `components/command-center.tsx:657, 664` |
| Remote device names | ⚠️ "Danish's Laptop" | `components/command-center.tsx:886` |

---

## What Is Missing

1. **Profile API** - No `/api/profile` route for read/update
2. **Profile Settings UI** - No settings page/component
3. **Dynamic Greetings** - Still uses email split or hardcoded "Danish"
4. **Onboarding Flow** - No first-login redirect to setup
5. **Avatar Support** - No upload/display for `avatar_url`
6. **Preferences Persistence** - No UI for timezone, bio, display_name

---

## Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Breaking voice wake-word | High | Do not modify wake-word string in Phase 3 Batch 1 |
| Breaking auth flow | High | Do not modify `auth-provider`, `auth-gate`, `lib/auth.ts` |
| Breaking existing API contracts | Medium | New route only, no changes to existing routes |
| TypeScript/build failures | Low | Run typecheck/lint/build after each batch |
| OneDrive `.next` build issue | Medium | Pre-existing, not caused by our changes |

---

## Files Likely to Change

### Batch 1 - Profile API & Read
- `app/api/profile/route.ts` (NEW)
- `components/command-center.tsx` - Import profile data, use in greeting

### Batch 2 - Profile Settings UI
- `components/profile-settings.tsx` (NEW)
- `components/command-center.tsx` - Add settings panel
- `app/dashboard/page.tsx` - May need route for settings

### Batch 3 - Onboarding & Greetings
- `components/onboarding.tsx` (NEW)
- `components/auth-provider.tsx` - Track onboarding state
- `components/command-center.tsx` - Show onboarding if incomplete

### Batch 4 - Remove Hardcoded References
- `components/command-center.tsx` - Replace remaining "Danish" strings
- `data/dashboard.ts` - Update mock device names

### Batch 5 - Mobile Readiness
- `components/command-center.tsx` - Touch improvements
- `app/globals.css` - Mobile-specific styles

---

## Rollback Strategy

```bash
# Batch 1 rollback
git restore -- app/api/profile/route.ts
git restore -- components/command-center.tsx

# Batch 2 rollback
git restore -- components/profile-settings.tsx
git restore -- components/command-center.tsx

# Batch 3 rollback
git restore -- components/onboarding.tsx
git restore -- components/auth-provider.tsx
git restore -- components/command-center.tsx

# Full Phase 3 rollback
git checkout HEAD -- .
```

---

## Mobile Compatibility Impact

| Change | Mobile Impact |
|--------|---------------|
| Profile API | None (backend) |
| Profile Settings UI | New component needs mobile-first design |
| Dynamic Greetings | None (text only) |
| Onboarding Flow | Needs mobile-friendly stepper |
| Hardcoded string removal | None |
| Mobile readiness | Primary focus of Batch 5 |

---

## Batch Plan

### Batch 1: Profile API + Dynamic Greeting (Current)
1. Create `/api/profile/route.ts` with GET (read) and PATCH (update)
2. Add profile fetch to CommandCenter
3. Replace `greetingName` in HeroCommand with profile `display_name`
4. Replace `ProfileSummary` to use profile data
5. **Verify**: TypeScript, Lint, Build, API test

### Batch 2: Profile Settings UI
1. Create `ProfileSettings` component with form for display_name, bio, timezone
2. Add to dashboard right sidebar (near ProfileSummary)
3. Wire PATCH to `/api/profile`
4. **Verify**: TypeScript, Lint, Build, UI test

### Batch 3: Onboarding Flow
1. Add `onboarding_completed` to profiles table (requires schema - defer)
2. Create `Onboarding` component (multi-step: name, timezone, preferences)
3. Show on first login if profile incomplete
4. **Verify**: TypeScript, Lint, Build, Flow test

### Batch 4: Remove Hardcoded "Danish"
1. Replace wake-word "Hello Danish" → configurable (defer to settings)
2. Replace "Danish's Laptop" → profile-based device naming
3. Replace MobileVoice "Good Evening, Danish" → profile name
4. **Verify**: TypeScript, Lint, Build, Voice test

### Batch 5: Mobile Readiness
1. Touch-friendly spacing on all panels
2. Mobile nav improvements
3. Responsive profile settings
4. **Verify**: TypeScript, Lint, Build, Mobile browser test

---

## Approval Required

**Ready to start Batch 1** upon approval.