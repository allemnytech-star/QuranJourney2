import { useEffect, useMemo, useRef, useState } from 'react'
import { firstLetter, fromGIndex, isMark, loadHafs, pageOf, surah } from '../../../lib/quran'
import { usePageState, MushafPage, type VisualMask } from '../../mushaf/page'
import { Icon, toAr, useProto } from '../core'
import { AI_DISCLAIMER, type TilawaEvent } from '../learning/contracts'
import type { Passage } from '../session'
import { useAudio } from '../screens/ayah'
import { getTilawa, tilawa, useTilawa } from './engine'
import { RecitationReport } from './History'
import { MODELS, SDK_VERSION, supportedDevice } from './models'
import { latestObservation, saveReport, type Observation, type Report, useReports } from './reports'
import { TilawaModels, toolButton } from './ModelManager'
import { getTasmeeOrigin } from '../TasmeeLink'
import type { TasmeeRange } from '../TasmeeLink'

type Location = {s: number; a: number; w: number}
type Visibility = 'visible' | 'progressive' | 'hidden'
export function splitPassage(scope: TasmeeRange): Passage[] {
  const [first, from] = fromGIndex(scope.g0)
  const [last, to] = fromGIndex(scope.g1)
  return Array.from({length: last - first + 1}, (_, i) => {
    const s = first + i
    return {s, from: s === first ? from : 1, to: s === last ? to : surah(s).ayat}
  })
}

type Take = {
  accepted: Set<string>; recited: Map<string, {s:number;a:number}>; uncertain: Map<string,Location>;
  observations: Map<string,Observation>; selected?: TasmeeRange; at: string;
}
const wordKey = ({s,a,w}: Location) => s + ':' + a + ':' + w
const emptyTake = (selected?: TasmeeRange): Take => ({accepted: new Set(), recited: new Map(), uncertain: new Map(), observations: new Map(), selected, at: new Date().toISOString() })
const duration = (ms: number) => toAr(Math.floor(ms / 60000)) + ':' + toAr(String(Math.floor(ms / 1000) % 60).padStart(2, '0'))

export default function SmartTasmee({ scope, free }: { scope: TasmeeRange | null; free: boolean }) {
  const { go } = useProto()
  const v = useTilawa()
  const reports = useReports()
  const segments = useMemo(() => scope ? splitPassage(scope) : [], [scope?.g0, scope?.g1])
  const [segment, setSegment] = useState(0)
  const selected = segments[segment]
  const [recording, setRecording] = useState<string>()
  const [last, setLast] = useState<Report>()
  const [saveFailed, setSaveFailed] = useState(false)
  const [current, setCurrent] = useState<Location>()
  const [tracking, setTracking] = useState<'acquiring' | 'tracking' | 'uncertain' | 'lost'>('acquiring')
  const [revision, redraw] = useState(0)
  const [presentation, setPresentation] = useState<'ayah' | 'page'>('ayah')
  const [visibility, setVisibility] = useState<Visibility>('progressive')
  const [hints, setHints] = useState<Record<string, number>>({})
  const [origin] = useState(getTasmeeOrigin)
  const [modelOpen, setModelOpen] = useState(false)
  const take = useRef<Take>(emptyTake())
  const owner = useRef(false)
  const anchor = current ?? (selected ? { s: selected.s, a: selected.from, w: 0 } : undefined)
  const reference = useAudio(anchor?.s ?? 1)
  const busy = v.mic !== 'idle'

  useEffect(() => () => {
    if (owner.current) void tilawa.release()
  }, [])

  const start = () => {
    if (v.mic !== 'idle' || (!selected && !free)) return
    reference.stop()
    owner.current = true
    take.current = emptyTake(scope ?? undefined)
    setCurrent(undefined)
    setRecording(undefined)
    setLast(undefined)
    setSaveFailed(false)
    setTracking('acquiring')
    setHints({})
    redraw((n) => n + 1)
    const receive = (event: TilawaEvent) => {
      const log = take.current
      if (event.kind === 'word') {
        log.accepted.add(wordKey(event))
        log.recited.set(event.s + ':' + event.a, {s: event.s, a: event.a})
        setCurrent(event)
        setTracking('tracking')
      } else if (event.kind === 'uncertain') {
        if (log.uncertain.size < 300) log.uncertain.set(wordKey(event), {s:event.s,a:event.a,w:event.w})
        setTracking('uncertain')
      } else if (event.kind === 'lost') {
        setTracking('lost')
      } else if (event.kind === 'observation') {
        latestObservation(log.observations, event)
      } else if (event.kind === 'end') {
        const done = getTilawa()
        if (!done.id) return
        const report: Report = {id: done.id, at: log.at, ms: done.ms, model: done.variant, engine: SDK_VERSION + ' · ' + MODELS[done.variant].id + '@1-int8',
          selected: log.selected, recited: [...log.recited.values()], uncertain: [...log.uncertain.values()], observations: [...log.observations.values()]}
        if (report.ms > 0) setSaveFailed(!saveReport(report))
        setRecording(report.id)
        setLast(report)
      }
      redraw((n) => n + 1)
    }
    void tilawa.start(selected ? {mode: 'passage', passage: selected} : {mode: 'free'}, receive)
  }

  const mask = useMemo<VisualMask>(() => {
    const palette = new Map<string, string>()
    for (const o of take.current.observations.values()) {
      if (o.state === 'suspected' || o.state === 'uncertain') palette.set(wordKey(o), 'bg-amber-300/35')
      if (o.state === 'confirmed') palette.set(wordKey(o), 'bg-red-400/25')
    }
    return {
      visibility: (s,a,w) => {
        const key = wordKey({s,a,w})
        return visibility === 'visible' || hints[key] === 2 || (visibility === 'progressive' && take.current.accepted.has(key)) ? 'shown' : hints[key] === 1 ? 'first' : 'hidden'
      },
      onWord: (s,a,w) => {
        const key = wordKey({s,a,w})
        setHints((old) => ({...old, [key]: (old[key] ?? 0) === 0 ? 1 : 2}))
      },
      wordClass: (s,a,w) => {
        const key = wordKey({s,a,w})
        return palette.get(key) ?? (current && wordKey(current) === key ? 'bg-gold-soft' : take.current.accepted.has(key) ? 'bg-green-400/20' : '')
      },
    }
  }, [current, visibility, hints, revision])

  const report = (recording && reports.find((x) => x.id === recording)) || last
  return (
    <section className="space-y-3 rounded-[22px] bg-night/[.04] p-4 text-sm ring-1 ring-line" data-tilawa-status>
      <h2 className="font-semibold">التسميع الذكي على الجهاز</h2>
      <p className="text-xs leading-relaxed text-muted">{AI_DISCLAIMER} تقتصر الملاحظات على الحفظ. يبقى الصوت على جهازك أثناء المعالجة ولا يُحفظ.</p>
      {!supportedDevice() && <p className="text-muted">يعتمد التسميع الآلي على دعم معالجة الصوت وWebAssembly SIMD. يمكنك التسميع يدويًا.</p>}
      {v.error && <p role="alert" className="text-clay">{v.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={toolButton} onClick={() => setModelOpen((x) => !x)} aria-expanded={modelOpen}>نماذج التسميع</button>
        {busy ? <button type="button" className={toolButton} onClick={() => void tilawa.stop()} disabled={v.mic === 'stopping'}>{v.mic === 'permission' ? 'إلغاء طلب الميكروفون' : 'أوقف التسميع'}</button>
          : <button type="button" className={toolButton} disabled={v.model !== 'ready' || (!selected && !free)} onClick={start} data-smart-start><Icon name="mic" size={16} className="inline" /> {report ? 'أعد التسميع الذكي' : 'ابدأ التسميع الذكي'}</button>}
        {origin && <button type="button" className={toolButton} onClick={() => go(origin.screen, origin.param)}>العودة إلى موضعك السابق</button>}
      </div>
      {modelOpen && <TilawaModels />}
      {segments.length > 1 && <label className="grid gap-1">النطاق الكامل يشمل {toAr(segments.length)} مقاطع، اختر مقطعًا للتسميع
        <select value={segment} disabled={busy} className="h-11 rounded-lg bg-card px-3 ring-1 ring-line" onChange={(e) => {setSegment(Number(e.target.value)); setCurrent(undefined); setLast(undefined); setRecording(undefined); setHints({}); take.current = emptyTake(); redraw((n) => n + 1)}}>
          {segments.map((p,i) => <option key={p.s} value={i}>{surah(p.s).ar} · {toAr(p.from)}–{toAr(p.to)}</option>)}
        </select>
      </label>}
      {busy && <div className="flex flex-wrap items-center gap-3">
        <span role="status">{v.mic === 'permission' ? 'انتظار إذن الميكروفون' : v.mic === 'stopping' ? 'جارٍ إنهاء التسميع' :
          tracking === 'tracking' ? 'يتتبّع التلاوة' : tracking === 'uncertain' ? 'الموضع غير مؤكّد' : tracking === 'lost' ? 'انقطع التتبّع. يمكنك اختيار مقطع محدّد.' : 'يحدّد موضع التلاوة'}</span>
        <time>{duration(v.ms)}</time><meter aria-label="مستوى صوت الميكروفون" min={0} max={1} value={v.level} />
      </div>}
      {anchor && <>
        <div className="flex flex-wrap gap-2">
          {(['ayah', 'page'] as const).map((p) => <button key={p} type="button" className={toolButton} aria-pressed={presentation === p} onClick={() => setPresentation(p)}>{p === 'ayah' ? 'وضع الآية' : 'وضع المصحف'}</button>)}
          <select className="min-h-11 rounded-full bg-card px-3 ring-1 ring-line" aria-label="ظهور النص" value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
            <option value="visible">النص ظاهر</option><option value="progressive">إظهار تدريجي</option><option value="hidden">التسميع من الحفظ</option>
          </select>
        </div>
        <p>{surah(anchor.s).ar} · الآية {toAr(anchor.a)}{current ? ' · كلمة ' + toAr(current.w + 1) : ''}</p>
        {presentation === 'page' ? <Page anchor={anchor} mask={mask} /> : <Ayah anchor={anchor} mask={mask} />}
        {!busy && <button type="button" className={toolButton} onClick={() => reference.a === anchor.a ? reference.stop() : reference.play(anchor.a)}>{reference.a === anchor.a ? 'أوقف الاستماع' : 'استمع للتلاوة المرجعية'}</button>}
      </>}
      {report && <RecitationReport report={report} />}
      {saveFailed && <p role="alert">تعذّر حفظ التقرير. يمكنك قراءته قبل مغادرة هذه الشاشة.</p>}
    </section>
  )
}

function Page({anchor, mask}: {anchor: Location; mask: VisualMask}) {
  const page = usePageState(pageOf(anchor.s, anchor.a))
  if (!page.d) return <p className="text-muted">{page.status === 'error' ? 'تعذّر تحميل نص الصفحة.' : 'جارٍ تحميل نص الصفحة…'}</p>
  if (!page.d.hafs) return <p>عرض التسميع يحتاج نص حفص المعتمد لهذه الصفحة.</p>
  return <div className="mp" data-tone="app"><MushafPage d={page.d} size={20} compact mask={mask} /></div>
}

function Ayah({anchor, mask}: {anchor: Location; mask: VisualMask}) {
  const [result, setResult] = useState<{s:number; a:number; text:string}>()
  const {s,a} = anchor
  useEffect(() => {
    let active = true
    void loadHafs(s).then((texts) => { if (active) setResult({s,a,text:texts[a - 1] ?? ''}) }, () => {})
    return () => { active = false }
  }, [s,a])
  if (!result || result.s !== s || result.a !== a || !result.text) return <p className="text-muted">نص حفص للآية غير متاح بعد.</p>
  return <p className="mf-text rounded-xl bg-card p-3 text-[24px] leading-loose">
    {result.text.split(/\s+/).filter(Boolean).map((word,w) => {
      const show = isMark(word) ? 'shown' : mask.visibility(s,a,w)
      return <span key={w}><span className={'relative inline-block rounded ' + (mask.wordClass?.(s,a,w) ?? '')}>
        <span style={{visibility: show === 'shown' ? 'visible' : 'hidden'}} aria-hidden={show !== 'shown'}>{word}</span>
        {show !== 'shown' && <button type="button" className="absolute inset-0 border-b border-dashed border-gold text-sm" aria-label="تلميح للكلمة" onClick={() => mask.onWord?.(s,a,w)}>{show === 'first' ? firstLetter(word) : ''}</button>}
      </span>{' '}</span>
    })}
  </p>
}
