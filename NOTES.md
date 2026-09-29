# m3e-canvas — cumulative fixes + Segmented Buttons part

Cumulative against your fork's HEAD (cf5cda3). Copy the files over the same paths, or
`git apply all-changes.patch`. Checked: `tsc --noEmit`, `vitest run` (775 tests),
`next build` — all pass. NOT checked against a real Supabase project.

## Since the last zip (v4)

- `lib/collaboration.ts` now retries a channel join a few times (1.5s/3s/5s/8s) when
  Realtime rejects it with a `MissingPartition`-style error, since that error means
  today's `realtime.messages` partition hasn't been created yet and usually clears up
  within seconds of a client connecting. Any other error still fails immediately.
- Added a **Segmented Buttons** part (Parts palette → Inputs). A single outlined pill,
  2–5 segments, single-select — the "Day / Week / Month" style control from the M3
  Expressive spec. Touches `lib/tokens.ts` (kind + sizing), `lib/i18n.ts` (labels in all
  4 languages), `components/M3Node.tsx` (rendering), `components/PartInspector.tsx`
  (segment editor), `components/Preview.tsx` (tap to select in preview), `lib/prompt.ts`
  (description in the generated prompt, all 4 languages).

## Image / video — already there, nothing to add

Both already exist as real parts, not placeholders:
- **Image** (Parts palette → Content): upload a picture, it fills the frame.
- **Video** (same section): upload a picture used as the poster frame, drawn with a
  play button and a progress bar overlay — there's no actual video playback since this
  is a static-mockup tool, not a prototyping runtime, but the part itself is there.
- A card, and a carousel's cards, can also each carry their own uploaded image.

If what you had in mind was something these don't cover — an image *gallery* part, or a
video part that actually plays a file you upload — say which and I'll scope it.

## Everything from the earlier zip is still in here

Auto-layout test fix, package-lock/npm ci fix, collaboration RLS schema (with the
recursion fix), `.env.example`, deploy.yml secrets wiring, i18n for the Collaborate
dialog, cloud save with email/password accounts. See the previous NOTES if you want the
full explanation of any of those — this file only covers what's new.
