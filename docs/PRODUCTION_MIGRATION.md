# Phase 1 production migration and Tasmee

The root URL opens the approved Next-generation application. The shell renders one screen against the actual viewport, keeping the existing desktop rail, CSS Scroll Snap feeds, Quran sources and illustrations. The mobile dock places سمّع in the center. More opens Plans and gives access to Guided, Free memorization, Revision, Azkar, Achievements, Kids and Settings. The app keeps the legacy shell and Studio routes available for recovery and review.

## Routes and Tasmee

- The root opens Home. Application screens use hash routes and work with browser Back, Forward and refresh. Guided and Free sessions use the existing persistent stores. The Mushaf also remembers the last page, selected reference and paper tone.
- Tasmee opens from Home, the dock and desktop rail, the Mushaf index and reader, the selected-ayah menu, Guided, Free memorization, full-page practice and Revision. The route carries inclusive canonical ayah indices, including across Surah boundaries.
- Manual Tasmee reuses the existing scope picker and hidden-text Guided recall, with explicit consent before it archives an unfinished session. Single Surah, page ranges and ayah groups work manually. Weak spots come from the learner’s existing unreviewed records. Automatic position detection and recognition show an unavailable state. Opening or using manual Tasmee never requests microphone access or records memorization by itself.
- The legacy application is at `/?app=legacy#/`. It uses its existing navigation and store. Design Studio is at `/#/design-studio/next` and uses the original Next preview keys. Both links work on the current origin and path.

## Storage and recovery

Phase 1 uses `quranJourney.production.*` for production and `quranJourney.production.migration.v1` for the migration marker. The app copies compatible Next progress, plan and revision history, guided sessions, task state, reflections, bookmarks, Azkar, Kids progress and achievements. It copies each eligible store only when the destination is empty, leaves each original intact and writes the marker after copying. Retries accept identical copies. The existing version-1 progress migration keeps the raw payload before repairing page-based records. Preview resets operate on the preview namespace.

A valid legacy theme can be copied into empty production preferences. With exactly one attributable, non-sample legacy learner and vacant compatible destinations, validated bookmarks, reflections and the last reading or memorization position can be copied. The legacy profile, progress, plans, revision schedule, Kids history, teacher records and recording references stay attached to their original profile in the legacy application. The Next data model has no safe per-profile mapping for those records. A demo-seeded preview progress store may contain real user work mixed with demo awards and task records. It is retained intact in Studio, along with incompatible or conflicting snapshots. Settings links to the recoverable originals, and Home points affected users to Settings.

The source and fallback must be opened on the same browser profile and origin that hold the data. A deployment preview on a separate origin has separate local storage.

## Verification

Run the following from the repository root.

- `pnpm exec tsc --noEmit`
- `pnpm run build`
- `node src/studio/next/tests/preview.test.mjs`
- `node src/studio/next/tests/render.smoke.mjs`

The Figma-export Git history lacks `59c6301`. The S5 fixture independently verifies the page-number repair, its exact canonical endpoints, preservation of the related records and original bytes, and a single migrated memorization record. If the historical object is available, the suite also runs the original generator.

## Preview and release

The checked-in Figma Make preview command is `bash .figma/make/deploy-preview`. Run it from the feature-branch checkout in an authenticated Figma Make environment with its CLI and dependencies installed. The command builds a development-mode preview and returns a preview URL. The production deploy script is separate.

Before a production release, confirm the existing Azkar publisher permission and independent scholarly review, and test physical older Android devices and assistive technology. Additional profile migration needs an explicit per-profile mapping and conflict policy.

## Phase 2

Follow-up work covers the Tilawa SDK and user-requested model downloads, verified inference and microphone lifecycle, Adaptive Hifz, Smart Revision and licensed fixed-layout Mushaf geometry. Analytics remain outside Phase 1.
