// Fixed, documented guided sequence (manual stand-in for the Adaptive Hifz Engine).
//
// This is NOT adaptive. It lays out the methodology (understand → listen → recall →
// cumulative → connect → recite → reflect → complete) for a passage, filtered by the
// learner's preference. The only rule that reacts to outcomes is stated in the UI:
// when the learner says they could not recall an ayah (or needed hints), one
// "weak words" card for that ayah is offered next. Codex replaces `buildSequence`
// + `followUps` with AdaptiveHifzEngine.next().
import type { Passage } from '../session'
import type { CardOutcome, GuidedCard, LearningPreference, SessionPreset } from './contracts'

const card = (type: GuidedCard['type'], s: number, from: number, to: number, extra: Partial<GuidedCard> = {}): GuidedCard => ({ id: `${type}:${s}:${from}-${to}`, type, s, from, to, ...extra })

/** Cumulative groups never repeat the whole passage once it is long: windows of up to 5 ayat. */
export const CUMULATIVE_WINDOW = 5

export function buildSequence(p: Passage, pref: LearningPreference, preset: SessionPreset = 'daily'): GuidedCard[] {
  const { s, from, to } = p
  if (preset === 'minute') return [card('recall', s, from, from, { reason: 'استرجاع آية واحدة' }), card('complete', s, from, from)]
  if (preset === 'tadabbur-moment') return [card('understand', s, from, from), card('reflect', s, from, from, { optional: true }), card('complete', s, from, from)]
  if (preset === 'quick-review' || pref === 'retention')
    return [card('recite', s, from, to, { reason: 'استرجاع دون مقدّمات' }), ...connects(s, from, to), card('complete', s, from, to)]
  const end = preset === 'five' ? Math.min(to, from + 1) : to
  const out: GuidedCard[] = [card('intro', s, from, end)]
  for (let a = from; a <= end; a++) {
    if (pref === 'tadabbur' || (pref === 'mastery' && a === from)) out.push(card('understand', s, a, a))
    else if (pref === 'fast' && a === from) out.push(card('understand', s, a, a, { optional: true, reason: 'معنى موجز' }))
    if (pref !== 'fast') out.push(card('listen', s, a, a))
    out.push(card('recall', s, a, a))
    if (pref === 'mastery') out.push(card('recall', s, a, a, { id: `recall2:${s}:${a}`, reason: 'استرجاع إضافي بعد فاصل' }))
    if (a > from) {
      const w0 = Math.max(from, a - CUMULATIVE_WINDOW + 1)
      out.push(card('cumulative', s, w0, a))
      out.push(card('connect', s, a - 1, a))
    }
  }
  if (end > from) out.push(card('recite', s, from, end))
  if (pref !== 'fast') out.push(card('reflect', s, from, end, { optional: true }))
  out.push(card('complete', s, from, end))
  return out
}
const connects = (s: number, from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, i) => card('connect', s, from + i, from + i + 1))

/**
 * The one stated outcome rule: an ayah recalled with hints / with difficulty / not at all
 * gets a weak-words card right after (once). Nothing else is inferred.
 */
export function followUps(seq: GuidedCard[], done: Record<string, CardOutcome>): GuidedCard[] {
  const out: GuidedCard[] = []
  for (const c of seq) {
    out.push(c)
    const o = done[c.id]
    if (c.type === 'recall' && o?.status === 'done' && o.recall && o.recall !== 'independent' && c.from === c.to) {
      const w = card('weak', c.s, c.from, c.to, { id: `weak:${c.s}:${c.from}:${c.id}`, reason: 'لأنك اخترت أنك احتجت مساعدة في هذه الآية' })
      if (!seq.some((x) => x.id === w.id)) out.push(w)
    }
  }
  return out
}

/** Rough planning aid only (never a promise): how many cards fit the chosen minutes. */
export const CARD_MINUTES: Record<GuidedCard['type'], number> = { intro: 0.5, understand: 1.5, listen: 1.5, recall: 2, weak: 1.5, cumulative: 2, connect: 1, recite: 3, reflect: 2, complete: 0.5 }
export function fitToMinutes(seq: GuidedCard[], minutes: number | null): GuidedCard[] {
  if (!minutes) return seq
  let t = 0
  const keep: GuidedCard[] = []
  for (const c of seq) {
    if (c.type === 'complete') continue
    if (t + CARD_MINUTES[c.type] > minutes && keep.length > 0) break
    t += CARD_MINUTES[c.type]
    keep.push(c)
  }
  const last = seq[seq.length - 1]
  return last?.type === 'complete' ? [...keep, last] : keep
}

export type Summary = { practiced: number; independent: number[]; hints: number[]; needs: number[]; skipped: number }
/** What actually happened, from recorded outcomes only. */
export function summarize(seq: GuidedCard[], done: Record<string, CardOutcome>): Summary {
  const by = new Map<number, string>()
  let practiced = 0
  let skipped = 0
  for (const c of seq) {
    const o = done[c.id]
    if (!o) continue
    if (o.status !== 'done') {
      skipped++
      continue
    }
    practiced++
    if ((c.type === 'recall' || c.type === 'weak') && o.recall && c.from === c.to) by.set(c.from, o.recall)
  }
  const pick = (f: (r: string) => boolean) => [...by].filter(([, r]) => f(r)).map(([a]) => a).sort((x, y) => x - y)
  return { practiced, independent: pick((r) => r === 'independent'), hints: pick((r) => r === 'hints'), needs: pick((r) => r === 'difficult' || r === 'unable'), skipped }
}
