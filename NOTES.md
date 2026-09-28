# m3e-canvas: Collaborate fix + cloud save (cumulative)

This zip replaces the first one. It holds every change against your fork's HEAD
(cf5cda3), including the earlier fixes (auto-layout tests, package-lock, i18n, deploy.yml).
Copy the files over the same paths, or `git apply all-changes.patch`.
Checked here: `tsc --noEmit`, `vitest run` (772 tests), `next build` all pass.
NOT checked: anything against a real Supabase project. I have no access to yours.

## Why Collaborate still failed

1. **My own schema.sql was broken.** The "members can read roommates" policy selected from
   the table it protects, so Postgres raises "infinite recursion detected in policy for
   relation collab_room_members". Joining a room and the Realtime channel policy both hit
   it. The new supabase/schema.sql uses a `security definer` function (`is_room_member`)
   instead. **Re-run the whole file**; it drops and recreates the old policies, so running
   it again is safe.
2. **Two Supabase clients raced each other.** Creating a room and opening the channel each
   made their own client on the same auth storage. Now there is one shared client
   (lib/supabase.ts).
3. **Errors were invisible.** Joining through a `#room=` link had no catch (stuck on
   "connecting" forever) and create-room errors only flashed as a 2 s toast. The dialog now
   shows the real error and a hint (missing table, anonymous sign-in off, policy problem).
4. **The button was buried** inside the "Ask AI" dialog. It is now also in the toolbar's
   folder menu (group icon).

If it still fails, open the Collaborate dialog and read the red box: it now says which
setting is missing.

## Setup checklist (all one-time)

- Supabase > SQL editor: run `supabase/schema.sql`
- Authentication > Sign In / Providers: Anonymous ON, Email ON
- Authentication > URL Configuration: Site URL = your deployed URL
- Realtime > Settings: Allow public access OFF
- Local: copy `.env.example` to `.env.local` and fill the two values, restart `npm run dev`
- GitHub Pages: add repo secrets NEXT_PUBLIC_SUPABASE_URL and
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (deploy.yml already passes them to the build)

## Cloud save with accounts (new)

Toolbar > folder icon > cloud icon. Email + password sign up / sign in (Supabase Auth),
"Save to cloud", a list of your projects with open / delete. Each project is one row in
`cloud_projects`, readable and writable only by its owner (RLS). Opening a project asks
before replacing the canvas; "Save to cloud" overwrites only the project the canvas was
opened from or last saved to, and the dialog says which one. "Save as new" makes a copy.

Notes:
- With "Confirm email" on in Supabase, a new account must click the emailed link before it
  can sign in; the dialog says so.
- Collaboration signs in anonymously through the same client. An anonymous session is not
  an account, so the cloud dialog treats it as signed out.
- Not done: Google/GitHub login (needs OAuth setup on your side), sharing a cloud project
  with other accounts, autosave.
