// Guided-learning preview store: onboarding profile, the active guided session and
// the learner's own weak-word records. Preview-only key, this browser/device only.
// Shared by every device frame (module-level store), so Mobile/Desktop/Both never
// run two sessions. Unreadable data is copied aside (quarantine) before any write.
import { useSyncExternalStore } from 'react'
import { surah } from '../../../lib/quran'
import { quarantine, readRaw, safeWrite } from '../storageSafety'
import { validatePassage, type Passage } from '../session'
import type { CardOutcome, LearningPreference, SessionPreset } from './contracts'

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
export type GuidedSession = { id: string; passage: Passage; preset: SessionPreset; preference: LearningPreference; minutes: number | null; idx: number; done: Record<string, CardOutcome>; startedAt: string; pausedAt: string | null; finishedAt: string | null }
/** Words the learner revealed during recall (their own signal, not an engine result). */
export type WeakRecord = { id: string; s: number; a: number; words: number[]; at: string; reviewed: string | null }
export type GuidedState = { v: 1; profile: Profile; session: GuidedSession | null; weak: WeakRecord[] }

export const DEFAULT_PROFILE: Profile = { onboarded: false, experience: null, reading: null, goal: null, style: null, preference: 'tadabbur', minutes: 10, selfReported: [] }
const empty = (): GuidedState => ({ v: 1, profile: { ...DEFAULT_PROFILE }, session: null, weak: [] })
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
  let session = s.session ?? null
  if (session && (typeof session !== 'object' || !session.passage || validatePassage(session.passage) || typeof session.idx !== 'number' || !session.done || typeof session.done !== 'object')) {
    session = null
    partial = true
  }
  const weak = Array.isArray(s.weak) ? s.weak.filter((w) => w && typeof w.s === 'number' && typeof w.a === 'number' && Array.isArray(w.words)) : []
  if (Array.isArray(s.weak) && weak.length !== s.weak.length) partial = true
  return { state: { v: 1, profile, session, weak }, partial }
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
    publish({ ...state, session: { id: `g${Date.now().toString(36)}`, passage, preset, preference: state.profile.preference, minutes, idx: 0, done: {}, startedAt: now(), pausedAt: null, finishedAt: null } })
    return true
  },
  setIdx: (idx: number) => state.session && state.session.idx !== idx && publish({ ...state, session: { ...state.session, idx, pausedAt: null } }),
  /** Idempotent per card: a later outcome replaces the earlier one for the same card. */
  record: (cardId: string, o: Omit<CardOutcome, 'at'>) => state.session && publish({ ...state, session: { ...state.session, done: { ...state.session.done, [cardId]: { ...o, at: now() } } } }),
  pause: () => state.session && publish({ ...state, session: { ...state.session, pausedAt: now() } }),
  finish: () => state.session && publish({ ...state, session: { ...state.session, finishedAt: state.session.finishedAt ?? now() } }),
  discard: () => publish({ ...state, session: null }),
  addWeak: (s: number, a: number, words: number[]) => {
    if (!words.length) return
    publish({ ...state, weak: [{ id: `w${Date.now().toString(36)}${state.weak.length}`, s, a, words: [...new Set(words)].sort((x, y) => x - y), at: now(), reviewed: null }, ...state.weak].slice(0, 200) })
  },
  reviewWeak: (id: string) => publish({ ...state, weak: state.weak.map((w) => (w.id === id ? { ...w, reviewed: w.reviewed ? null : now() } : w)) }),
  deleteWeak: (id: string) => publish({ ...state, weak: state.weak.filter((w) => w.id !== id) }),
  /** Test/reset helper (preview only). */
  reset: () => publish(empty()),
}
