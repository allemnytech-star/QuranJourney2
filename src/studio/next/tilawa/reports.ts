import { useSyncExternalStore } from 'react'
import { SURAHS, TOTAL_AYAT } from '../../../lib/quran'
import type { ModelVariant, TilawaEvent } from '../learning/contracts'
import { quarantine, readRaw, safeWrite } from '../storageSafety'

export type Observation = Extract<TilawaEvent, {kind: 'observation'}>
export type Report = {
  id: string
  at: string
  ms: number
  model: ModelVariant
  engine: string
  selected?: { g0: number; g1: number }
  recited: { s: number; a: number }[]
  uncertain: { s: number; a: number; w: number }[]
  observations: (Observation & { reviewed?: boolean })[]
}
const KEY = 'quranJourney.production.tilawaReports.v1'
const empty: Report[] = []
let snapshot: Report[] | undefined
const listeners = new Set<() => void>()
const validAyah = (v: {s: number; a: number}) => v && Number.isInteger(v.s) && Number.isInteger(v.a) && v.a > 0 && v.a <= (SURAHS[v.s - 1]?.ayat ?? 0)
const validWord = (v: {s: number; a: number; w: number}) => validAyah(v) && Number.isInteger(v.w) && v.w >= 0 && v.w < 200
const validReport = (r: Report) => r && typeof r.id === 'string' && typeof r.at === 'string' &&
  Number.isFinite(r.ms) && r.ms >= 0 && typeof r.engine === 'string' && (r.model === 'light' || r.model === 'full') &&
  (!r.selected || (Number.isInteger(r.selected.g0) && Number.isInteger(r.selected.g1) && r.selected.g0 >= 1 && r.selected.g1 >= r.selected.g0 && r.selected.g1 <= TOTAL_AYAT)) &&
  Array.isArray(r.recited) && r.recited.every(validAyah) && Array.isArray(r.uncertain) && r.uncertain.every(validWord) &&
  Array.isArray(r.observations) && r.observations.every((item) => validWord(item) && typeof item.id === 'string' &&
    ['incorrect-word','missing-word','extra-word','skipped'].includes(item.type) &&
    ['suspected','confirmed','resolved','uncertain'].includes(item.state))

function read(): Report[] {
  const { raw } = readRaw(KEY)
  if (raw === null) return empty
  try {
    const data = JSON.parse(raw)
    if (data?.v !== 1 || !Array.isArray(data.sessions)) throw new Error('Invalid recitation history')
    const reports = (data.sessions as Report[]).filter(validReport)
    if (reports.length !== data.sessions.length) quarantine(KEY, raw, true)
    return reports
  } catch {
    quarantine(KEY, raw)
    return empty
  }
}

export function latestObservation(map: Map<string, Observation>, observation: Observation) {
  const prior = map.get(observation.id)
  if (!prior && map.size >= 300) return
  // The SDK emits transitions for the same issue ID. Keep its latest state.
  map.set(observation.id, observation)
}

function publish(change: (reports: Report[]) => Report[]) {
  const sessions = change(read()).slice(0, 40)
  if (!safeWrite(KEY, JSON.stringify({ v: 1, sessions }))) return false
  snapshot = sessions
  listeners.forEach((f) => f())
  return true
}

export const saveReport = (report: Report) => publish((rows) => [report, ...rows.filter((r) => r.id !== report.id)])
export const clearReports = () => publish(() => [])
export const markReviewed = (id: string, issue: string) => publish((rows) => rows.map((r) => r.id !== id ? r : {
  ...r, observations: r.observations.map((o) => o.id === issue ? { ...o, reviewed: true } : o),
}))
export const useReports = () => useSyncExternalStore(
  (f) => {
    listeners.add(f)
    const storage = (event: StorageEvent) => { if (event.key === KEY) { snapshot = undefined; f() } }
    window.addEventListener('storage', storage)
    return () => { listeners.delete(f); window.removeEventListener('storage', storage) }
  },
  () => snapshot ??= read(),
  () => empty,
)
