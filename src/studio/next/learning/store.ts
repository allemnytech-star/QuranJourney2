// Guided-learning preview store: onboarding profile, the active guided session and
// the learner's own weak-word records. Preview-only key, this browser/device only.
// Shared by every device frame (module-level store), so Mobile/Desktop/Both never
// run two sessions. Unreadable data is copied aside (quarantine) before any write.
import { useSyncExternalStore } from 'react'
import { gIndex, surah } from '../../../lib/quran'
import { quarantine, readRaw, safeWrite } from '../storageSafety'
import { validatePassage, type Passage } from '../session'
import type { CardOutcome, LearningPreference, SessionPreset } from './contracts'
import { scopeChunks, scopeOfAyat, validScope, type MemorizationScope } from './scope'

export const GUIDED_KEY = 'quranJourney.nextPreview.guided.v1'

export type Profile = {
  onboarded: boolean
  experience: 'none' | 'some' | 'much' | null
  reading: 'learning' | 'fluent' | null
  goal: 'hifz' | 'retention' | 'understanding' | null
  style: 'guided' | 'free' | null
  preference: LearningPreference
  minutes: number | null
  /** Self-reported, never verified mastery. */
  selfReported: { s: number; from: number; to: number }[]
}
export type Presentation = 'focus' | 'mushaf'
export type Experience = 'guided' | 'free'
export type SegmentResult = { done: Record<string, CardOutcome>; practicedAt: string }
export type GuidedSession = {
  id: string
  /** Full requested range; never truncated to the current 20-ayah passage. */
  scope: MemorizationScope
  passage: Passage
  segmentIndex: number
  segmentResults: Record<string, SegmentResult>
  presentation: Presentation
  experience: Experience
  preset: SessionPreset
  preference: LearningPreference
  minutes: number | null
  idx: number
  done: Record<string, CardOutcome>
  startedAt: string
  pausedAt: string | null
  finishedAt: string | null
  awayToMushaf?: boolean
}
/** Words the learner revealed during recall (their own signal, not an engine result). */
export type WeakRecord = { id: string; s: number; a: number; words: number[]; at: string; reviewed: string | null }
export type GuidedState = { v: 1; profile: Profile; session: GuidedSession | null; saved: GuidedSession[]; weak: WeakRecord[] }

export const DEFAULT_PROFILE: Profile = { onboarded: false, experience: null, reading: null, goal: null, style: null, preference: 'tadabbur', minutes: 10, selfReported: [] }
const empty = (): GuidedState => ({ v: 1, profile: { ...DEFAULT_PROFILE }, session: null, saved: [], weak: [] })
const PREFS: LearningPreference[] = ['fast', 'tadabbur', 'mastery', 'retention']

export function normalizeGuided(x: unknown): { state: GuidedState; partial: boolean } {
  if (!x || typeof x !== 'object' || (x as { v?: number }).v !== 1) throw new Error('shape')
  const s = x as Partial<GuidedState>
  let partial = false
  const p = (s.profile ?? {}) as Partial<Profile>
  const profile: Profile = {
    ...DEFAULT_PROFILE,
    ...p,
    preference: PREFS.includes(p.preference as LearningPreference) ? (p.preference as LearningPreference) : ((partial = p.preference !== undefined || partial), 'tadabbur'),
    minutes: p.minutes === null || (typeof p.minutes === 'number' && p.minutes > 0 && p.minutes <= 240) ? (p.minutes ?? null) : 10,
    selfReported: Array.isArray(p.selfReported) ? p.selfReported.filter((r) => r && !validatePassageLoose(r)) : [],
  }
  const rawSession = s.session as unknown
  let session: GuidedSession | null = null
  if (rawSession && typeof rawSession === 'object') {
    const x = rawSession as Partial<GuidedSession> & { passage?: Passage }
    if (x.passage && !('scope' in x)) {
      const p0 = x.passage
      session = validatePassage(p0) ? null : ({ ...x, scope: scopeOfAyat(p0.s, p0.from, p0.to), segmentIndex: 0, segmentResults: {}, presentation: 'focus', experience: 'guided' } as GuidedSession)
      partial = true
    } else session = x as GuidedSession
  }
  if (session && (typeof session !== 'object' || !session.passage || validatePassage(session.passage) || !validScope(session.scope) || typeof session.idx !== 'number' || !session.done || typeof session.done !== 'object')) {
    session = null
    partial = true
  }
  const weak = Array.isArray(s.weak) ? s.weak.filter((w) => w && typeof w.s === 'number' && typeof w.a === 'number' && Array.isArray(w.words)) : []
  if (Array.isArray(s.weak) && weak.length !== s.weak.length) partial = true
  const saved = Array.isArray(s.saved) ? s.saved.filter((x) => x && validScope(x.scope) && x.passage && !validatePassage(x.passage)).slice(0, 8) : []
  return { state: { v: 1, profile, session, saved, weak }, partial }
}
// Self-reported ranges may be longer than a 20-ayah session (a whole surah); check real bounds only.
const validatePassageLoose = (r: Passage) => {
  const n = surah(r?.s)?.ayat
  return n && Number.isInteger(r.from) && Number.isInteger(r.to) && r.from >= 1 && r.to >= r.from && r.to <= n ? null : 'range'
}

function load(): GuidedState {
  const { raw } = readRaw(GUIDED_KEY)
  if (!raw) return empty()
  try {
    const { state, partial } = normalizeGuided(JSON.parse(raw))
    if (partial) quarantine(GUIDED_KEY, raw, true)
    return state
  } catch {
    quarantine(GUIDED_KEY, raw)
    return empty()
  }
}
let state: GuidedState = load()
const subs = new Set<() => void>()
function publish(next: GuidedState) {
  state = next
  safeWrite(GUIDED_KEY, JSON.stringify(state))
  subs.forEach((f) => f())
}
export const useGuided = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state)
export const getGuided = () => state

const now = () => new Date().toISOString()
export const guided = {
  setProfile: (p: Partial<Profile>) => publish({ ...state, profile: { ...state.profile, ...p } }),
  addSelfReported: (r: Passage) => {
    if (validatePassageLoose(r)) return false
    publish({ ...state, profile: { ...state.profile, selfReported: [...state.profile.selfReported, r] } })
    return true
  },
  removeSelfReported: (i: number) => publish({ ...state, profile: { ...state.profile, selfReported: state.profile.selfReported.filter((_, j) => j !== i) } }),
  /** Starts (or replaces) the single guided session. */
  start: (passage: Passage, preset: SessionPreset, minutes: number | null = state.profile.minutes) => {
    if (validatePassage(passage)) return false
    return guided.startScope(scopeOfAyat(passage.s, passage.from, passage.to), preset, minutes, 'focus', 'guided')
  },
  /** Starts an exact canonical scope. An unfinished session is archived, never silently discarded. */
  startScope: (scope: MemorizationScope, preset: SessionPreset = 'daily', minutes: number | null = state.profile.minutes, presentation: Presentation = 'focus', experience: Experience = 'guided') => {
    if (!validScope(scope)) return false
    const chunks = scopeChunks(scope)
    const first = chunks[0]
    if (!first) return false
    const saved = state.session && !state.session.finishedAt ? [state.session, ...state.saved].slice(0, 8) : state.saved
    publish({
      ...state,
      saved,
      session: {
        id: `g${Date.now().toString(36)}`,
        scope,
        passage: { s: first.s, from: first.from, to: first.to },
        segmentIndex: 0,
        segmentResults: {},
        presentation,
        experience,
        preset,
        preference: state.profile.preference,
        minutes,
        idx: 0,
        done: {},
        startedAt: now(),
        pausedAt: null,
        finishedAt: null,
      },
    })
    return true
  },
  setPresentation: (presentation: Presentation) => state.session && publish({ ...state, session: { ...state.session, presentation } }),
  setAwayToMushaf: (awayToMushaf: boolean) => state.session && publish({ ...state, session: { ...state.session, awayToMushaf } }),
  /** Move between scope chunks while preserving each chunk's card outcomes. This records practice only, never memorisation. */
  setSegment: (segmentIndex: number, practiced = false) => {
    if (!state.session) return false
    const chunks = scopeChunks(state.session.scope)
    const n = Math.max(0, Math.min(chunks.length - 1, segmentIndex))
    const next = chunks[n]
    if (!next) return false
    const current = chunks[state.session.segmentIndex]
    const segmentResults = { ...state.session.segmentResults }
    if (current && (practiced || Object.keys(state.session.done).length)) segmentResults[current.id] = { done: state.session.done, practicedAt: now() }
    const restored = segmentResults[next.id]?.done ?? {}
    publish({ ...state, session: { ...state.session, passage: { s: next.s, from: next.from, to: next.to }, segmentIndex: n, segmentResults, done: restored, idx: 0, pausedAt: null } })
    return true
  },
  setIdx: (idx: number) => state.session && state.session.idx !== idx && publish({ ...state, session: { ...state.session, idx, pausedAt: null } }),
  /** Idempotent per card: a later outcome replaces the earlier one for the same card. */
  record: (cardId: string, o: Omit<CardOutcome, 'at'>) => state.session && publish({ ...state, session: { ...state.session, done: { ...state.session.done, [cardId]: { ...o, at: now() } } } }),
  pause: () => state.session && publish({ ...state, session: { ...state.session, pausedAt: now() } }),
  finish: () => state.session && publish({ ...state, session: { ...state.session, finishedAt: state.session.finishedAt ?? now() } }),
  discard: () => publish({ ...state, session: null }),
  restoreSaved: (id: string) => {
    const found = state.saved.find((x) => x.id === id)
    if (!found) return false
    const saved = state.session && !state.session.finishedAt ? [state.session, ...state.saved.filter((x) => x.id !== id)].slice(0, 8) : state.saved.filter((x) => x.id !== id)
    publish({ ...state, session: found, saved })
    return true
  },
  addWeak: (s: number, a: number, words: number[]) => {
    if (!words.length) return
    publish({ ...state, weak: [{ id: `w${Date.now().toString(36)}${state.weak.length}`, s, a, words: [...new Set(words)].sort((x, y) => x - y), at: now(), reviewed: null }, ...state.weak].slice(0, 200) })
  },
  reviewWeak: (id: string) => publish({ ...state, weak: state.weak.map((w) => (w.id === id ? { ...w, reviewed: w.reviewed ? null : now() } : w)) }),
  deleteWeak: (id: string) => publish({ ...state, weak: state.weak.filter((w) => w.id !== id) }),
  /** Test/reset helper (preview only). */
  reset: () => publish(empty()),
}
