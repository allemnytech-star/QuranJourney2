// Canonical memorization scopes. A scope may span pages, surahs or an entire Juz;
// learning still happens in existing ≤20-ayah, single-surah chunks.
import { JUZ, PAGES, TOTAL_AYAT, fromGIndex, gIndex, juzEnd, pageEnd, pageOf, surah } from '../../../lib/quran'
import { chunksOf } from '../progress'

export type ScopeKind = 'ayahs' | 'surah' | 'pages' | 'juz'
export type MemorizationScope = {
  kind: ScopeKind
  g0: number
  g1: number
  label: string
  fromPage: number
  toPage: number
  source?: 'manual' | 'mushaf' | 'plan'
}
export type ScopeSeed =
  | { kind: 'ayah'; s: number; a: number }
  | { kind: 'from-ayah'; s: number; a: number }
  | { kind: 'ayahs'; s: number; from: number; to: number }
  | { kind: 'surah'; s: number }
  | { kind: 'page'; page: number }
  | { kind: 'pages'; from: number; to: number }
  | { kind: 'juz'; juz: number }

export const validScope = (x: MemorizationScope | null | undefined): x is MemorizationScope =>
  !!x && Number.isInteger(x.g0) && Number.isInteger(x.g1) && x.g0 >= 1 && x.g1 >= x.g0 && x.g1 <= TOTAL_AYAT

const make = (kind: ScopeKind, g0: number, g1: number, label: string, source: MemorizationScope['source'] = 'manual'): MemorizationScope => {
  const [s0, a0] = fromGIndex(g0)
  const [s1, a1] = fromGIndex(g1)
  return { kind, g0, g1, label, fromPage: pageOf(s0, a0), toPage: pageOf(s1, a1), source }
}
export const scopeOfCanonical = (g0: number, g1: number, label: string, source: MemorizationScope['source'] = 'manual') => make('ayahs', g0, g1, label, source)

export const scopeOfSurah = (s: number, source?: MemorizationScope['source']) =>
  make('surah', gIndex(s, 1), gIndex(s, surah(s).ayat), `سورة ${surah(s).ar} كاملة`, source)
export const scopeOfAyat = (s: number, from: number, to: number, source?: MemorizationScope['source']) =>
  make('ayahs', gIndex(s, from), gIndex(s, to), `سورة ${surah(s).ar} · الآيات ${from}–${to}`, source)
export const scopeFromAyah = (s: number, a: number, source?: MemorizationScope['source']) =>
  make('ayahs', gIndex(s, a), gIndex(s, surah(s).ayat), `سورة ${surah(s).ar} · من الآية ${a} إلى نهاية السورة`, source)
export const scopeOfPages = (from: number, to: number, source?: MemorizationScope['source']) => {
  const a = Math.max(1, Math.min(604, from))
  const b = Math.max(a, Math.min(604, to))
  return make('pages', gIndex(...PAGES[a - 1]), gIndex(...pageEnd(b)), a === b ? `الصفحة ${a}` : `الصفحات ${a}–${b}`, source)
}
export const scopeOfJuz = (j: number, source?: MemorizationScope['source']) => {
  const n = Math.max(1, Math.min(30, j))
  return make('juz', gIndex(...JUZ[n - 1]), gIndex(...juzEnd(n)), `الجزء ${n} كاملًا`, source)
}
export const scopeFromSeed = (seed: ScopeSeed): MemorizationScope => {
  if (seed.kind === 'ayah') return scopeOfAyat(seed.s, seed.a, seed.a, 'mushaf')
  if (seed.kind === 'from-ayah') return scopeFromAyah(seed.s, seed.a, 'mushaf')
  if (seed.kind === 'ayahs') return scopeOfAyat(seed.s, seed.from, seed.to, 'mushaf')
  if (seed.kind === 'surah') return scopeOfSurah(seed.s, 'mushaf')
  if (seed.kind === 'page') return scopeOfPages(seed.page, seed.page, 'mushaf')
  if (seed.kind === 'pages') return scopeOfPages(seed.from, seed.to, 'mushaf')
  return scopeOfJuz(seed.juz, 'mushaf')
}

export const scopeChunks = (s: MemorizationScope) => chunksOf(s.g0, s.g1)
export const scopeSummary = (s: MemorizationScope) => {
  const [s0, a0] = fromGIndex(s.g0)
  const [s1, a1] = fromGIndex(s.g1)
  return {
    ...s,
    ayat: s.g1 - s.g0 + 1,
    chunks: scopeChunks(s).length,
    from: { s: s0, a: a0 },
    to: { s: s1, a: a1 },
    range: s0 === s1 ? `سورة ${surah(s0).ar} · ${a0}–${a1}` : `${surah(s0).ar} ${a0} ← ${surah(s1).ar} ${a1}`,
  }
}
