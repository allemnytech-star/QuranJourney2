import { SURAHS, pageOf } from '../../lib/quran'
import { isProduction } from '../../lib/applicationMode'

const preview = 'quranJourney.nextPreview'
const production = 'quranJourney.production'
export const productionKey = (suffix: string) => production + suffix
export const nextKey = (suffix: string) => (isProduction ? production : preview) + suffix
export const MIGRATION_KEY = productionKey('.migration.v1')
export const APPEARANCE_KEY = productionKey('.appearance.v1')
export const MUSHAF_KEY = productionKey('.mushaf.v1')

const stores = ['.v1', '.azkar.v1', '.session.v1', '.guided.v1', '.activeTask.v1'] as const
type Migration = { v: 1; retainedInPreview: string[]; legacy: boolean }
export type Appearance = { theme: 'light' | 'dark' | 'system'; palette: 'garden' | 'sea' | 'dusk' | 'sand' | 'rose' }

export function readAppearance(value: unknown): Appearance {
  const a = value as Partial<Appearance> | null
  return {
    theme: a?.theme === 'dark' || a?.theme === 'light' ? a.theme : 'system',
    palette: a?.palette === 'sea' || a?.palette === 'sand' || a?.palette === 'dusk' || a?.palette === 'rose' ? a.palette : 'garden',
  }
}

type LegacyProfile = {
  id: string
  sample?: boolean
  bookmarks?: unknown
  notes?: unknown
  last?: { s: number; a: number; mode: string } | null
}

const validAyah = (s: number, a: number) =>
  Number.isInteger(s) && Number.isInteger(a) && a >= 1 && a <= (SURAHS[s - 1]?.ayat ?? 0)

function validRef(key: unknown): key is string {
  if (typeof key !== 'string' || !/^[1-9][0-9]*:[1-9][0-9]*$/.test(key)) return false
  const [s, a] = key.split(':').map(Number)
  return validAyah(s, a)
}

function importLegacyPreferencesAndReading(s: Pick<Storage, 'getItem' | 'setItem'>, raw: string) {
  let legacy
  try { legacy = JSON.parse(raw) } catch { return }
  if (legacy?.v !== 1) return
  if (s.getItem(APPEARANCE_KEY) === null) s.setItem(APPEARANCE_KEY, JSON.stringify(readAppearance(legacy)))
  // A profile can be attributed only when there's exactly one real learner.
  // Preview/production copies win as whole stores, with originals recoverable.
  if (legacy.mode !== 'learner' || !Array.isArray(legacy.profiles) || legacy.profiles.length !== 1) return
  const profile = legacy.profiles[0] as LegacyProfile | null
  if (!profile || profile.sample || typeof profile.id !== 'string' || profile.id !== legacy.activeId) return
  const last = profile.last && validAyah(profile.last.s, profile.last.a) ? profile.last : null
  const sessionKey = productionKey('.session.v1')
  if (s.getItem(sessionKey) === null && s.getItem(preview + '.session.v1') === null) {
    const marks = Object.fromEntries((Array.isArray(profile.bookmarks) ? profile.bookmarks : []).filter(validRef).map((key) => [key, true]))
    const notes = Object.fromEntries(Object.entries(profile.notes ?? {}).filter(([key, note]) => validRef(key) && typeof note === 'string'))
    const passage = last?.mode === 'memorize' ? { s: last.s, from: last.a, to: last.a } : { s: 1, from: 1, to: 7 }
    if (Object.keys(marks).length || Object.keys(notes).length || last?.mode === 'memorize') {
      s.setItem(sessionKey, JSON.stringify({ v: 1, passage, cur: passage.from, marks, notes }))
    }
  }
  if (last?.mode === 'read' && s.getItem(MUSHAF_KEY) === null && s.getItem(preview + '.v1') === null) {
    const pg = pageOf(last.s, last.a)
    s.setItem(MUSHAF_KEY, JSON.stringify({ nav: { pg, focus: { s: last.s, a: last.a } }, stage: 'reader', tone: 'app' }))
  }
}

export let migration: Migration | null = null
export function migrateProductionStorage(storage?: Pick<Storage, 'getItem' | 'setItem'>): Migration | null {
  try {
    const s = storage ?? localStorage
    const previous = s.getItem(MIGRATION_KEY)
    if (previous !== null) {
      const saved = JSON.parse(previous) as Migration
      return migration = saved?.v === 1 && Array.isArray(saved.retainedInPreview) ? saved : null
    }
    const legacy = s.getItem('rafiqi.app.v1')
    const report: Migration = { v: 1, retainedInPreview: [], legacy: legacy !== null }
    for (const suffix of stores) {
      const source = s.getItem(preview + suffix)
      if (source === null) continue
      let compatible = false
      try {
        const data = JSON.parse(source)
        compatible = suffix === '.v1'
          ? (data?.v === 1 || data?.v === 2) && data.seed === 'empty'
          : suffix === '.activeTask.v1' ? data && typeof data === 'object' && ('active' in data || 'mapJuz' in data) : data?.v === 1
        if (suffix === '.activeTask.v1' && data?.active?.kind === 'plan') {
          // A plan task must point to the same progress snapshot.
          compatible = compatible && s.getItem(preview + '.v1') !== null && !report.retainedInPreview.includes('.v1')
        }
      } catch { /* Original stays available in Studio. */ }
      const key = productionKey(suffix)
      const existing = s.getItem(key)
      if (!compatible || (existing !== null && existing !== source)) {
        report.retainedInPreview.push(suffix)
      } else if (existing === null) {
        s.setItem(key, source)
      }
    }
    if (legacy !== null) importLegacyPreferencesAndReading(s, legacy)
    // Write the version marker last. An interrupted retry recognizes copies by
    // their original bytes and leaves every conflicting destination untouched.
    s.setItem(MIGRATION_KEY, JSON.stringify(report))
    return migration = report
  } catch {
    return migration = null
  }
}
