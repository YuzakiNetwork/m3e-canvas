# Fixes for YuzakiNetwork/m3e-canvas

Verified against your fork: `npx tsc --noEmit`, `npx vitest run` (767/767 tests),
and `npx next build` all pass after these changes.

## How to apply

Either:
- copy each file in this zip over the matching path in your repo, or
- run `git apply fixes.patch` from your repo root (covers every file except
  the two brand-new ones, `.env.example` and `supabase/schema.sql`, which you
  just copy in — `git apply` doesn't create untracked new files from a diff
  cleanly in every git version, so those two are included as plain files).

## What was broken

1. **`lib/auto-layout.test.ts` — 3 failing tests.**
   Not a bug in the new auto-layout code itself — the test's hand-written
   expected numbers used the button's *height* (56) where they meant its
   *width* (128), so `94`/`144`/`59` never matched what `layoutOf()` actually
   returns. Fixed by giving the test buttons an explicit `size: 60` (so the
   test isn't silently tied to `KIND_SPEC.button.w`) and correcting the math.

2. **`package-lock.json` was out of sync with `package.json`.**
   `@supabase/supabase-js` was added to `dependencies` but the lockfile was
   never regenerated. Since both `ci.yml` and `deploy.yml` run `npm ci`
   (which refuses to run when the two files disagree), **every CI run and
   every GitHub Pages deploy on this repo has been failing** since the
   collaboration commits landed. Confirmed by reproducing the exact `npm ci`
   error, then fixing it with `npm install` and committing the regenerated
   lockfile.

3. **The collaboration feature has no database behind it.**
   `lib/collaboration.ts` reads and writes `collab_rooms` and
   `collab_room_members`, but no migration for those tables (or their RLS
   policies, or the Realtime Authorization policies a private channel needs)
   was ever committed. Added `supabase/schema.sql` — run it once in your
   Supabase project's SQL editor. It also needs "Anonymous sign-ins" turned
   on (Authentication → Sign In / Providers) and "Allow public access" turned
   **off** (Realtime → Settings), both one-time dashboard toggles that can't
   be done via SQL.

4. **No `.env.example`, and `.gitignore` would have blocked it anyway.**
   Nothing told a contributor which two env vars enable collaboration.
   Added `.env.example` with the two vars and a short setup checklist, and
   added `!.env.example` to `.gitignore` (the existing `.env*` rule was
   silently excluding it).

5. **The GitHub Pages deploy never had a way to enable collaboration.**
   `deploy.yml` builds a static export but never passed the two
   `NEXT_PUBLIC_SUPABASE_*` values into the build step, so even after adding
   them as repo secrets, the deployed site would keep the feature dark. Wired
   both through as `secrets.*` (optional — leave them unset and the site
   behaves exactly as before, with the Collaborate dialog just saying it
   isn't configured).

6. **The collaboration UI bypassed the app's i18n system.**
   Every other string in this app is fully localized (ja/en/zh/ko, enforced
   by `lib/i18n.parity.test.ts`), but the "Collaborate" pill in `ShareMenu.tsx`
   and all of `CollaborationDialog.tsx` were hardcoded English. Added the
   matching keys to `UI`/`KO` in `lib/i18n.ts` and wired both components
   through `t()`. Parity tests pass with the new keys.

7. **A collaboration error toast bypassed the app's toast helper.**
   `app/Editor.tsx`'s room-creation failure path called the raw `setToast`
   setter instead of the `showToast` helper everywhere else in the file uses
   (which adds the icon/auto-dismiss timer), and the fallback message was
   hardcoded English instead of going through `t()`. Fixed to match the rest
   of the file and added a `collabCreateError` i18n key.

## Still worth doing (not included here, out of scope for a fix pass)

- The Collaborate dialog and Editor's collaboration code haven't been
  exercised against a real Supabase project by me — I verified the schema
  against Supabase's documented Realtime Authorization pattern, but you
  should smoke-test create-room / join-room / leave-room once you have a
  project wired up.
- No automated test covers `lib/collaboration.ts` itself (it's all
  network-calling code, so it'd need mocking the Supabase client) — the
  existing `767 passed` count doesn't include any coverage of this file.
