// Typed integration contracts for the three future learning engines (design handoff).
//
// Nothing in this file decides anything. It defines the shapes the UI already
// renders, so Codex can plug in:
//   - AdaptiveHifzEngine  — chooses the next guided card (local, deterministic)
//   - SmartRevisionEngine — schedules reviews (local, deterministic)
//   - TilawaEngine        — on-device recitation tracking (@tilawa/core, not installed)
// Until an engine exists, the preview uses the documented fixed sequence in
// ./sequence.ts and shows honest "not available yet" states. No adaptive
// decision, review date, recognition event or model progress is ever simulated.

import type { Passage } from '../session'

// ---------------------------------------------------------------- Guided feed
export type CardType =
  | 'intro' // passage introduction
  | 'understand' // quick understanding (attributed Tafsir)
  | 'listen' // reference recitation / listen and repeat
  | 'recall' // active recall with progressive hiding and graduated hints
  | 'weak' // targeted weak-word practice (words the learner had to reveal)
  | 'cumulative' // recall 1..n together
  | 'connect' // end of ayah → start of next
  | 'recite' // full passage from memory
  | 'reflect' // optional reflection
  | 'complete' // session completion

export type GuidedCard = { id: string; type: CardType; s: number; from: number; to: number; optional?: boolean; reason?: string }

/** A learner's own assessment of one recall attempt. The only source of "how did it go". */
export type RecallOutcome = 'independent' | 'hints' | 'difficult' | 'unable'
/** What happened to a card. `skipped` / `deferred` are never treated as completed. */
export type CardOutcome = { status: 'done' | 'skipped' | 'deferred'; recall?: RecallOutcome; hintsUsed?: number; revealed?: number[]; at: string }

export type LearningPreference = 'fast' | 'tadabbur' | 'mastery' | 'retention'
export const PREFERENCE_AR: Record<LearningPreference, { ar: string; sub: string }> = {
  fast: { ar: 'الحفظ السريع', sub: 'استرجاع مبكّر، معنى موجز، تكرار أقل' },
  tadabbur: { ar: 'الحفظ مع التدبّر', sub: 'افهم، استمع، احفظ، اربط، وتأمّل · موصى به' },
  mastery: { ar: 'الحفظ المتقن', sub: 'استرجاع إضافي، كلمات صعبة، ربط وانتقالات' },
  retention: { ar: 'تثبيت المحفوظ', sub: 'مراجعة أولًا، استرجاع دون مقدّمات' },
}

export type SessionPreset = 'minute' | 'five' | 'quick-review' | 'tadabbur-moment' | 'daily'
export const PRESET_AR: Record<SessionPreset, { ar: string; sub: string; icon: string }> = {
  daily: { ar: 'ورد اليوم', sub: 'جلسة موجّهة كاملة', icon: 'sparkle' },
  minute: { ar: 'دقيقة مع القرآن', sub: 'استرجاع آية واحدة', icon: 'clock' },
  five: { ar: '٥ دقائق حفظ', sub: 'نشاط حفظ قصير', icon: 'sprout' },
  'quick-review': { ar: 'تثبيت سريع', sub: 'استرجاع ما حفظته', icon: 'repeat' },
  'tadabbur-moment': { ar: 'لحظة تدبّر', sub: 'آية ومعناها وتأمّل اختياري', icon: 'tafsir' },
}

export interface AdaptiveHifzEngine {
  /** Returns the next card from real outcomes only; `null` ends the session. */
  next(input: { passage: Passage; preference: LearningPreference; minutes: number | null; done: Record<string, CardOutcome>; history: ReviewItem[] }): GuidedCard | null
  /** Suggested repetitions for a listen card (replaces the learner-chosen default). */
  repetitions?(card: GuidedCard, done: Record<string, CardOutcome>): number
}

// ---------------------------------------------------------------- Retention
export type RetentionState = 'new' | 'initial' | 'consolidating' | 'strong' | 'established' | 'needs-review'
export const RETENTION_AR: Record<RetentionState, string> = {
  new: 'حفظ جديد',
  initial: 'محفوظ مبدئيًا',
  consolidating: 'جارٍ التثبيت',
  strong: 'حفظ قوي',
  established: 'حفظ راسخ',
  'needs-review': 'يحتاج مراجعة',
}
export type ReviewAssessment = RecallOutcome
export const ASSESS_AR: Record<ReviewAssessment, string> = { independent: 'تذكّرتها وحدي', hints: 'بمساعدة تلميح', difficult: 'بصعوبة', unable: 'لم أتذكّرها' }

/**
 * Initial, configurable heuristics only — not a Quran memorisation formula. Shown in the UI as
 * such. The real scheduler decides from actual recall results.
 */
export const SUGGESTED_INTERVALS: { id: string; ar: string; days: number | null }[] = [
  { id: 'end', ar: 'نهاية الجلسة', days: null },
  { id: 'same-day', ar: 'لاحقًا في اليوم نفسه', days: 0 },
  { id: 'd1', ar: 'بعد يوم', days: 1 },
  { id: 'd3', ar: 'بعد ٣ أيام', days: 3 },
  { id: 'd7', ar: 'بعد ٧ أيام', days: 7 },
  { id: 'd14', ar: 'بعد ١٤ يومًا', days: 14 },
  { id: 'd30', ar: 'بعد ٣٠ يومًا', days: 30 },
]

export type ReviewItem = { s: number; from: number; to: number; state: RetentionState; lastAssessment?: ReviewAssessment; lastAt?: string; dueAt?: string }
export interface SmartRevisionEngine {
  due(on: string): ReviewItem[]
  overdue(on: string): ReviewItem[]
  upcoming(from: string, days: number): ReviewItem[]
  record(item: Pick<ReviewItem, 's' | 'from' | 'to'>, a: ReviewAssessment, at: string): ReviewItem
  /** Suggests lowering new memorisation when review load is high (never enforced). */
  workload(on: string): { reviews: number; suggestReduceNew: boolean }
}

// ---------------------------------------------------------------- Tilawa
export type TilawaState =
  | 'not-installed'
  | 'select-passage'
  | 'preparing-model'
  | 'mic-permission'
  | 'ready'
  | 'listening'
  | 'identifying'
  | 'tracking'
  | 'uncertain'
  | 'lost'
  | 'suspected-mistake'
  | 'confirmed-mistake'
  | 'self-corrected'
  | 'completed'
  | 'unsupported-device'
  | 'engine-unavailable'

export type MistakeKind = 'incorrect-word' | 'missing-word' | 'extra-word' | 'skipped'
export const MISTAKE_AR: Record<MistakeKind, string> = { 'incorrect-word': 'كلمة مختلفة', 'missing-word': 'كلمة ناقصة', 'extra-word': 'كلمة زائدة', skipped: 'آية أو مقطع متجاوز' }

/** Events the adapter must emit, always mapped to the authoritative Hafs words (s, a, word index). */
export type TilawaEvent =
  | { kind: 'identified'; s: number; a: number; confidence: number }
  | { kind: 'word'; s: number; a: number; w: number }
  | { kind: 'uncertain'; s: number; a: number; w: number }
  | { kind: 'lost' }
  | { kind: 'mistake'; s: number; a: number; w: number; type: MistakeKind; certainty: 'suspected' | 'confirmed' }
  | { kind: 'self-corrected'; s: number; a: number; w: number }
  | { kind: 'end' }

export interface TilawaEngine {
  /** Only the categories the real SDK supports; the UI hides the rest. */
  readonly supports: MistakeKind[]
  load(variant: ModelVariant, onProgress: (loaded: number, total: number) => void, signal: AbortSignal): Promise<void>
  start(opts: { mode: 'passage'; passage: Passage } | { mode: 'free' }, on: (e: TilawaEvent) => void): Promise<void>
  stop(): Promise<void>
  /** Releases microphone and inference memory. Must be idempotent. */
  release(): Promise<void>
}

/** Persisted mistake record (future). Never fabricated; the preview shows empty states. */
export type MistakeRecord = { id: string; s: number; a: number; w: number | null; type: MistakeKind; source: 'engine' | 'self'; certainty: 'suspected' | 'confirmed'; at: string; reviewed?: string }

// ---------------------------------------------------------------- Model manager
export type ModelVariant = 'light' | 'full'
/** Advertised download sizes, subject to verification against the real SDK. Download ≠ RAM use. */
export const MODEL_VARIANTS: Record<ModelVariant, { ar: string; approxMB: number; sub: string }> = {
  light: { ar: 'الوضع الخفيف', approxMB: 25, sub: 'للأجهزة محدودة الذاكرة' },
  full: { ar: 'الوضع الكامل', approxMB: 68, sub: 'دقّة أعلى متوقّعة' },
}
export type ModelState = 'not-loaded' | 'downloading' | 'initializing' | 'ready-offline' | 'failed' | 'no-storage' | 'unsupported'
export const MODEL_STATE_AR: Record<ModelState, string> = {
  'not-loaded': 'محرك التسميع غير محمّل',
  downloading: 'جارٍ التحميل',
  initializing: 'جارٍ التجهيز',
  'ready-offline': 'جاهز للتسميع دون إنترنت',
  failed: 'تعذّر التحميل',
  'no-storage': 'مساحة التخزين غير كافية',
  unsupported: 'الجهاز غير مدعوم',
}

export const AI_DISCLAIMER = 'التصحيح الآلي أداة مساعدة للحفظ، وقد يخطئ أو لا يكتشف بعض الأخطاء، ولا يغني عن معلّم قرآن مؤهل.'
