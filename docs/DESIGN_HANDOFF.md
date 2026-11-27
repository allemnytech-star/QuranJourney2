# Quran Journey — Design & Engineering Handoff

**Quran Journey — احفظ بفهم، وثبّت بذكاء**

The approved Next-generation screens are the Phase 1 production application at the root URL. The Design Studio still hosts its review surface at `#/design-studio/next`. See [Production migration](PRODUCTION_MIGRATION.md) for the rollout, data compatibility, Tasmee entry points and checks.

The pre-migration Git checkpoint is `checkpoint/production-tasmee-base` at `2ec3b614024b18c162b05f55581c08629c0294a7`. The notes below retain the original design handoff and its historical verification.

Status labels used below:
- **EXISTING**: worked before this round, reused as is.
- **NEW · FUNCTIONAL**: new manual behaviour that works now on real data.
- **DESIGN READY**: UI and typed contract exist. It needs an engine or data before it can work.
- **ENGINE-DEPENDENT**: waits for Adaptive Hifz, Smart Revision or Tilawa.
- **NOT VERIFIED**: not checked on real devices.

---

## 1. Product overview

- The app is completely free. It has no ads, paywalls, subscriptions or paid AI APIs.
- Learning philosophy:
  - Understand, listen, actively recall, connect, recite and retain.
  - Sessions are finite and have a purpose. Streaks, urgency and time-on-app goals are excluded.
  - The app does not replace a qualified teacher.
- Integrity rules, enforced in code:
  - Opening, swiping, listening, reading Tafsir and skipping never count as memorisation.
  - An ayah counts as memorised only through an explicit confirmation (`progress.confirmMemorized`).
  - AI recognition will never count as mastery.
  - Nothing is fabricated: no Quran text, Tafsir, word meanings, mistakes, scores, review dates or model progress.
- Preserved: plans and versions, tasks, step confirmations, session, bookmarks, reflections, similarity links, map and library, achievements, kids progress, Azkar (content, counters, history, favourites), and themes.

## 2. Screen inventory and navigation

| Screen id | Arabic | Status |
|---|---|---|
| `home` | رحلتك اليوم | EXISTING, evolved: «ابدأ / تابع ورد اليوم» primary action, «تعلّم اليوم» card (presets, three experiences, onboarding nudge) |
| `guided` | رحلتي الموجّهة | **NEW · FUNCTIONAL** Guided Smart Feed |
| `ayah` | الحفظ الحر (رحلة الحفظ) | EXISTING free vertical feed, unchanged behaviour |
| `revision` | تثبيت المحفوظ والمراجعة | EXISTING, plus a NEW retention section and «مواضع تحتاج إلى مراجعة» |
| `recite` | التسميع الذكي وتصحيح الحفظ | Production opt-in on-device Tasmee and manual recall. Muaalem remains a Studio research tool. |
| `settings` | الإعدادات | Learning preferences, self-reported memorisation, Tilawa model management, privacy and local data. |
| `welcome` | الترحيب والإعداد | **NEW · FUNCTIONAL** skippable onboarding |
| `mushaf`, `plans`, `week`, `map`, `rewards`, `library`, `kids`, `azkar`, `azkar-list`, `similar` | | EXISTING, unchanged |

- The production mobile dock has الرئيسية، المصحف، سمّع، تقدمي، المزيد. The desktop rail and More tabs expose the other screens, including Guided, Free memorisation, Plans, Azkar, Achievements and Kids.
- Entry points to the three experiences:
  - Home hero and home learning card.
  - The Guided start screen («تجارب أخرى»).
  - The navigation rail and dock.

## 3. Guided Smart Feed (`screens/guided.tsx`)

**Reused from `screens/ayah.tsx`:** the CSS scroll-snap feed, the IntersectionObserver frame sync, `useAyat` (exact text, loading/error/retry, 15 s stall timeout), `useAudio` (EveryAyah, repeat count), `TafsirSnippet` (التفسير الميسّر, attributed), `PassagePicker` (≤ 20 ayat, validated) and `LoadState`.

**Card types** (`learning/contracts.ts → CardType`):

| Card | Purpose |
|---|---|
| `intro` | Introduces the passage |
| `understand` | Shows the meaning from attributed Tafsir |
| `listen` | Listen and repeat, with a 1–10 repetition stepper |
| `recall` | Active recall in three modes (visible, partial hiding, from memory). Hints are graduated: first letter, then the full word, plus «reveal next word» and retry |
| `weak` | Hides only the words this learner revealed earlier in the session |
| `cumulative` | Recalls a window of up to 5 ayat (`CUMULATIVE_WINDOW`) |
| `connect` | Shows the end of one ayah and asks for the start of the next |
| `recite` | Full passage hidden, with per-ayah first word, reveal and retry |
| `reflect` | Optional personal note, kept separate from Tafsir |
| `complete` | Session completion |

**Order:** `learning/sequence.ts → buildSequence(passage, preference, preset)`. This is a **fixed, documented order. It is not adaptive.**
- Preferences: `fast`, `tadabbur` (default), `mastery` and `retention`.
- Presets: `daily`, `minute` (one ayah), `five`, `quick-review` and `tadabbur-moment`.
- `fitToMinutes` trims cards to the chosen time as a rough aid, never a promise. It always keeps the completion card.
- There is exactly one outcome rule (`followUps`), and it is stated in the UI: when a recall was assessed as anything other than «تذكّرتها وحدي», one `weak` card is inserted after it.

**Navigation:**
- Vertical swipe works.
- Previous and next buttons work.
- On desktop, the feed takes ArrowUp/Down and PageUp/Down when focused, and a side «مخطط الجلسة» outline can jump to any card.
- A progress bar shows the current card.

**State:** `learning/store.ts`, key `quranJourney.nextPreview.guided.v1`.
- There is one session for all frames (module store with `useSyncExternalStore`).
- `done[cardId] = { status: 'done'|'skipped'|'deferred', recall?, hintsUsed?, revealed? }`. A later outcome for the same card replaces the earlier one.
- Skip or defer is stored as such and is never counted as done.
- Pause (✕ / «أوقف مؤقتًا») keeps the session. Home then shows «تابع ورد اليوم» with the card number.
- Completion:
  - Shows what was actually recalled independently, what needed hints, what needs practice and what was deferred.
  - Offers per-ayah «أؤكّد حفظ الآية» buttons. These are the only path to memorisation (session `setMemAt` and `progress.confirmMemorized`).
  - States that no review date is scheduled.
- Passage choice per preset (`useStartGuided`):
  - `daily`: the first ≤ 20-ayah chunk of today's open Hifz task, otherwise the session passage.
  - `minute`: a memorised record, otherwise the current ayah.
  - `quick-review`: assessed session ayat, then memorised records, then self-reported passages. If none exist, it shows an honest message.
- Workload hint: when 5 or more places need review, the app suggests reducing new memorisation. It is never enforced.

### 3.1 Mushaf-based selection and long memorization scopes

**NEW · FUNCTIONAL:** `learning/selector.tsx` is the shared «ابدأ الحفظ» selector. Entry points are the Surah index, Juz index, current Mushaf page, selected-ayah action menu, Guided start and Free memorization.

Supported scopes:
- Entire Surah.
- One ayah, from one ayah to the end of its Surah, or an ayah range.
- One page or a page range, including ranges crossing Surah boundaries.
- Entire Juz.

Before starting, the selector shows the exact canonical endpoints, page range, ayah count and learning-chunk count. It also asks for Guided/Free experience and Focus/Mushaf presentation. «حفظ» is a separate ayah action from «تسميع»; listen, Tafsir, bookmark, copy and share remain unchanged.

If an unfinished session exists, starting is blocked until the learner explicitly resumes it or confirms replacement. Replaced sessions are retained in `guided.saved` (up to eight), not silently discarded.

**Shared scope architecture** (`learning/scope.ts`, `learning/store.ts`):
- `MemorizationScope = { kind, g0, g1, label, fromPage, toPage, source }`.
- `g0…g1` is the complete requested canonical range and is never truncated.
- `scopeChunks()` uses the existing `chunksOf()` logic: every learning segment is ≤20 ayat and never crosses a Surah boundary.
- `GuidedSession` stores the full `scope`, current `passage`, `segmentIndex`, `segmentResults`, card `idx`/outcomes, `presentation`, `experience` and return-to-Mushaf state.
- Moving between segments saves and restores card outcomes. Segment practice never records memorization.
- The scheduled «مهمة اليوم» uses the full task range. Manual selection calls `startScope()` directly, so the plan cannot silently replace it.

Regression tests cover the full 110 ayat of Al-Kahf, a page range crossing Al-Fatiha/Al-Baqarah, segment resume, view switching without progress writes and explicit archival of an unfinished session.

### 3.2 Synchronized Focus and Mushaf views

`GuidedSession.presentation` is persistent and shared by Guided and Free experiences.

- **Focus View:** existing vertical Smart Feed / Free Ayah feed.
- **Mushaf View:** `screens/guidedMushaf.tsx`.
  - Loads the current page; `usePageState` prefetches only adjacent pages.
  - Shows full verified page text, page number, Surah, current-ayah highlight, previous/next page, zoom, audio ×3 and Tafsir.
  - Keeps the same session, card, full scope, segment and assessment outcomes.
  - Opening the Digital Mushaf and returning restores the same Guided/Free session.

This is a **verified full-page context view**, not authentic fixed-layout visual memorization. The UI states that it uses the current flowing renderer.

### 3.3 Progressive full-page hiding

`MushafPage`/`PageText` now accepts an optional `VisualMask`:
- `visibility(s, a, wordIndex) → shown | hidden | first`.
- `onWord(s, a, wordIndex)` for graduated reveal.
- Stable `data-word="surah:ayah:index"` keys prepare authoritative Tilawa mapping.

Modes: full text, hide words, hide current ayah, hide confirmed-memorized ayat, progressive page hiding and recitation without looking. Controls reveal the first letter, selected word, current ayah or whole page, and reset the exercise.

The exact original word remains in flow with `visibility:hidden`, preserving its measured dimensions in the current layout. It is `aria-hidden`; the replacement control exposes instructions but not the answer. This prevents reflow and screen-reader answer leakage, but does not create unavailable printed-page coordinates.

## 4. Adaptive learning (methodology mapping)

| Stage | Where |
|---|---|
| افهم | `understand` card. Word meanings show a missing-source notice (no verified dataset) |
| استمع وردّد | `listen` card. Segment repetition is disabled because there are no verified timestamps or waqf boundaries |
| احفظ واسترجع | `recall` and `weak` cards. Revealed words are stored as weak words |
| اربط | `cumulative` and `connect` cards, plus the existing ConnectPanel and SimilarPanel in Free mode |
| سمّع | `recite` card (manual). Production Smart Tasmee is available on supported devices |
| ثبّت | `complete` card and the Revision retention section |

- The existing six-step `MemorizePanel` in Free mode is preserved unchanged.
- **Visual Mushaf memorisation (fixed layout): BLOCKED on data.** Repository inspection found verified KFGQPC Hafs text, page starts/ends and fonts, but no licensed printed-page line/word geometry or authentic page images. It needs edition-matched data for every word/glyph with at least `page`, `line`, order, x/y or fixed advance, ayah-marker geometry, Surah-header/Bismillah geometry, opening-page exceptions and a documented redistribution licence. The data must match the bundled KFGQPC Hafs text/font version exactly. Line-start and spatial-location exercises remain unavailable; the current renderer makes no claim of authentic geometry.

## 5. Retention (`screens/retention.tsx`, inside Revision)

Learning states (`RETENTION_AR`) come from the learner's own records only:
- `needs-review`: session results «أخطأت قليلًا / لم أتذكّرها».
- `initial`: confirmed memorisation.
- `new`: assessed but not confirmed.
- `consolidating`, `strong` and `established` show «يتطلّب المحرك» because they need the scheduler.
- No numeric mastery percentages are shown.

**Suggested intervals** (`SUGGESTED_INTERVALS`): end of session, the same day, then 1, 3, 7, 14 and 30 days. They are labelled as configurable heuristics.

**Due, overdue and upcoming:** these show an explicit "Smart Revision Engine not active" state. No dates exist.

**«مواضع تحتاج إلى مراجعة»:**
- Self tab: revealed-word records with the words highlighted in the real Hafs text, a recurring-ayah badge and filters. Actions: open ayah, retry (minute session), mark reviewed and delete.
- Engine tab: an honest empty state.

**Integration:** existing plan revision tasks and manual revision are untouched. Retention never adds memorised ayat, never resets progress and never penalises.

**Future scheduler:** implement `SmartRevisionEngine` (`due`, `overdue`, `upcoming`, `record`, `workload`). It must de-duplicate against `planTasks` revision tasks (same `g0..g1` and date).

## 6. Religious content

- **Quran text:** KFGQPC Hafs via `lib/quran.loadMushaf`, with a labelled Tanzil fallback drawn in the Tanzil font. It is never hand-typed.
- **Tafsir:** `lib/tafsir` verbatim (التفسير الميسّر, King Fahd Complex; others in Free mode) with source labels.
- **Missing verified data:** each item below needs a sourced dataset or recording before it can be used.
  - Word-by-word meanings.
  - Fixed-layout Mushaf geometry.
  - Ayah-segment audio timestamps with valid stopping points.
  - Verified mutashabihat (still `[]`).
  - Kids audio.
  - Azkar audio.
  - Scholarly review of Azkar, and publisher permission.

## 7. AI integration (Tilawa)

- Production Smart Tasmee is opt-in. Opening the screen does not fetch the model or request a microphone. The ayah and flowing Mushaf views share the live browser take.
- A single WASM worker uses actual Tilawa events. Declared passages reject out-of-scope positions and exact word markers require alignment with authoritative Hafs text.
- Actual observations stay local and can be revisited in Revision. The manual hidden-text path and explicit mastery checks remain available. Muaalem stays in Studio.
- See [Tilawa integration](TILAWA_INTEGRATION.md) and [Performance report](PERFORMANCE_REPORT.md) for the selected SDK, weights, licensing, benchmark results and browser limitations.

## 8. Visual design

- **Tokens:** the existing Sakina tokens and palettes (`src/studio/next/DESIGN.md`, `next.css`, `themeScope.ts`). Classes include `mf-paper`, `mf-text` and `glass-panel`.
- **Illustration registry:** `illustrations.tsx`, the single source for feature art.
  - Lightweight local SVG in a soft 3D style: emerald, champagne gold, ivory and wood, with one light source and a contact shadow.
  - IDs: `guided`, `free`, `retention`, `minute`, `tadabbur`, `recite`, `model`, `mushaf`, `mistakes`, `welcome`.
  - Functional icons stay in `components/Icon`.
  - Still to cover: Azkar sub-types, Dua, Tasbeeh, Plans, Week, Map, Library, Kids and Bookmarks. Several already have isometric art in `iso.tsx`.
  - Gradient colours are fixed hex values. Checking them in dark mode is NOT VERIFIED.
- **Hero Mushaf:** `quranBook.tsx`. The initial visual is permanently page 1 on the right (complete Al-Fatiha) and page 2 on the left (the beginning of Al-Baqarah), loaded through `usePageState` from the verified KFGQPC Hafs files and actual project page mapping. It uses the Uthmani font, source-aware Bismillah, ayah markers, a larger near-overhead text plane, curved paper, layered page edges, a shaded gutter, cover edges and a wooden rehal. Clicking it still opens the user's actual continue-reading page. Progress uses the ribbon and glow and never recolours Quran text. Lines reflow because no line/word coordinate data exists; the component deliberately does not claim fixed printed-page geometry.
- **Accessibility:**
  - RTL throughout.
  - Card navigation never depends on swipe alone.
  - Radio groups and progress bars have ARIA roles.
  - Touch targets are ≥ 40–48 px.

## 9. Engineering preparation

**New files:**
- `learning/contracts.ts`
- `learning/scope.ts`
- `learning/selector.tsx`
- `learning/sequence.ts`
- `learning/store.ts`
- `illustrations.tsx`
- `screens/guided.tsx`
- `screens/guidedMushaf.tsx`
- `screens/retention.tsx`
- `screens/tilawa.tsx`
- `screens/settings.tsx`
- `screens/welcome.tsx`

**Modified files:**
- `core.tsx` (ScreenId, NAV)
- `NextPreview.tsx` (screens, notes)
- `session.tsx` (`setNoteAt`, `setMemAt`)
- `storageSafety.tsx` (store name)
- `screens/ayah.tsx` (Free scope and synchronized Mushaf presentation)
- `screens/mushaf.tsx`, `screens/mushafIndex.tsx` (memorization entry points and return flow)
- `studio/mushaf/actions.tsx`, `desktop.tsx`, `mobile.tsx`, `page.tsx` (separate Hifz action and dimension-preserving masks)
- `screens/home.tsx`
- `screens/revision.tsx`
- `screens/recite.tsx` (restructure; Muaalem flow unchanged inside `MuaalemLab`)
- `tests/*`

**Integration points:**
- Replace `buildSequence`/`followUps` with `AdaptiveHifzEngine.next()`.
- Implement `SmartRevisionEngine` and feed the retention panel.
- Implement a `TilawaEngine` adapter and the model manager.
- Persist `MistakeRecord`.

**Phase 1 production entry**

- `src/studio/next/ProductionApp.tsx` owns one session provider and one responsive screen. It reuses the application chrome in `core.tsx`.
- Tasmee uses the shared scope selector and the existing Guided manual recall cards. The canonical range is carried in the route and survives refresh.
- The storage migration copies compatible stores to the production namespace. Legacy profile records and conflicting snapshots remain accessible through Settings.
- Real older Android devices and assistive technology remain to be checked before release.

## 10. Verification from the original design handoff

- `pnpm exec tsc --noEmit`: clean.
- `pnpm run build`: succeeds. The only warning is the existing chunk-size warning.
- `node src/studio/next/tests/preview.test.mjs`: 31 / 32 pass.
  - G1–G9 cover the sequence, outcome rule, time fitting, store integrity, full Al-Kahf scope, cross-Surah page ranges, chunk resume, presentation switching and unfinished-session archival.
  - **S5 fails for a pre-existing reason:** it runs `git show 59c6301`, and that commit is not in this repository's history.
- `node src/studio/next/tests/render.smoke.mjs`: 100 / 100 renders.
  - Covers all screens on mobile and desktop, plus Guided Focus/Mushaf presentation, Mushaf memorization entry, home resume, retention, Tilawa and model-manager states.
- **NOT VERIFIED:** live browser interaction (the preview browser was not connected), real devices, dark mode, all palettes, long-ayah layouts on small screens, and screen readers.
