// Full-page context view for the same guided session/card. It uses the verified
// flowing Mushaf renderer because fixed printed-page geometry is not bundled.
// Presentation changes never write memorization progress.
import { useEffect, useState } from 'react'
import { pageOf, surah } from '../../../lib/quran'
import { MushafPage, PageError, PageSkeleton, TOTAL_PAGES, usePageState, type WordVisibility } from '../../mushaf/page'
import { Icon, toAr } from '../core'
import { akey, useSession } from '../session'
import { guided } from '../learning/store'
import { useAudio, TafsirSnippet } from './ayah'
import { useOpenInMushaf } from './mushaf'

type HideMode = 'full' | 'words' | 'current' | 'memorized' | 'progressive' | 'no-look'
const MODES: [HideMode, string][] = [
  ['full', 'النص كاملًا'],
  ['words', 'إخفاء كلمات'],
  ['current', 'إخفاء الآية الحالية'],
  ['memorized', 'إخفاء الآيات المحفوظة'],
  ['progressive', 'إخفاء تدريجي للصفحة'],
  ['no-look', 'التسميع دون النظر'],
]

export function GuidedMushafView({ s, a }: { s: number; a: number }) {
  const targetPage = pageOf(s, a)
  const [pg, setPg] = useState(targetPage)
  const [mode, setMode] = useState<HideMode>('full')
  const [amount, setAmount] = useState(50)
  const [zoom, setZoom] = useState(1)
  const [highlight, setHighlight] = useState(true)
  const [revealed, setRevealed] = useState<Record<string, 'first' | 'shown'>>({})
  const [revealAyah, setRevealAyah] = useState<string | null>(null)
  const [showTafsir, setShowTafsir] = useState(false)
  const page = usePageState(pg)
  const ses = useSession()
  const audio = useAudio(s)
  const openMushaf = useOpenInMushaf()
  const currentKey = akey(s, a)
  useEffect(() => setPg(targetPage), [targetPage])
  useEffect(() => (setRevealed({}), setRevealAyah(null)), [pg, mode])

  const baseHidden = (ws: number, wa: number, w: number) => {
    if (mode === 'full') return false
    if (mode === 'no-look') return true
    if (mode === 'current') return ws === s && wa === a
    if (mode === 'memorized') return ses.s.mem[akey(ws, wa)] === 'mastered'
    if (mode === 'words') return (ws * 17 + wa * 7 + w * 11) % 4 === 0
    return (ws * 17 + wa * 7 + w * 11) % 100 < amount
  }
  const visibility = (ws: number, wa: number, w: number): WordVisibility => {
    if (revealAyah === akey(ws, wa)) return 'shown'
    const k = `${ws}:${wa}:${w}`
    if (revealed[k]) return revealed[k]
    return baseHidden(ws, wa, w) ? 'hidden' : 'shown'
  }
  const onWord = (ws: number, wa: number, w: number) => {
    const k = `${ws}:${wa}:${w}`
    setRevealed((x) => ({ ...x, [k]: x[k] === 'first' ? 'shown' : 'first' }))
  }
  const reset = () => (setRevealed({}), setRevealAyah(null))
  const d = page.d
  const currentOnPage = d?.blocks.some((b) => b.s === s && b.ayat.some((x) => x.a === a))
  const marks = highlight && currentOnPage ? { state: { [currentKey]: 'selected' as const } } : {}

  return (
    <div className="space-y-3" data-guided-mushaf data-page={pg} data-current={`${s}:${a}`}>
      <div className="flex flex-wrap items-center gap-2 rounded-[16px] bg-card p-2.5 ring-1 ring-line">
        <button type="button" onClick={() => setPg((n) => Math.max(1, n - 1))} disabled={pg <= 1} aria-label="الصفحة السابقة" className="press flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-line disabled:opacity-30"><Icon name="chevron" size={15} /></button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[13px] font-semibold">صفحة {toAr(pg)} · {d ? d.surahs.map((x) => surah(x).ar).join('، ') : '…'}</p>
          <p className="text-[10.5px] text-muted">{currentOnPage ? `الآية الحالية: ${surah(s).ar} ${toAr(a)}` : `الآية الحالية في الصفحة ${toAr(targetPage)}`}</p>
        </div>
        <button type="button" onClick={() => setPg((n) => Math.min(TOTAL_PAGES, n + 1))} disabled={pg >= TOTAL_PAGES} aria-label="الصفحة التالية" className="press flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-line disabled:opacity-30"><Icon name="chevron" size={15} className="rotate-180" /></button>
        <button type="button" onClick={() => (guided.setAwayToMushaf(true), openMushaf(s, a))} className="press h-9 rounded-full px-3 text-[11.5px] ring-1 ring-line">افتح المصحف الرقمي</button>
      </div>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1" role="radiogroup" aria-label="إخفاء النص">
        {MODES.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`press h-8 shrink-0 rounded-full px-3 text-[11.5px] ${mode === k ? 'bg-night text-parchment' : 'bg-card ring-1 ring-line'}`}>{l}</button>)}
      </div>
      {mode === 'progressive' && <label className="flex items-center gap-2 text-[11.5px] text-muted">نسبة الإخفاء<input type="range" min={10} max={100} step={10} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="flex-1 accent-[var(--color-gold)]" /><b>{toAr(amount)}٪</b></label>}

      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
        <button type="button" onClick={() => setRevealAyah(currentKey)} className="press h-8 rounded-full px-3 ring-1 ring-line">أظهر الآية الحالية</button>
        <button type="button" onClick={() => (setMode('full'), reset())} className="press h-8 rounded-full px-3 ring-1 ring-line">أظهر الصفحة كاملة</button>
        <button type="button" onClick={reset} className="press h-8 rounded-full px-3 ring-1 ring-line">إعادة التمرين</button>
        <button type="button" onClick={() => setHighlight((x) => !x)} aria-pressed={highlight} className="press h-8 rounded-full px-3 ring-1 ring-line">{highlight ? 'أخفِ تظليل الآية' : 'ظلّل الآية الحالية'}</button>
        <span className="ms-auto flex items-center gap-1">
          <button type="button" onClick={() => setZoom((x) => Math.max(0.85, +(x - 0.05).toFixed(2)))} aria-label="تصغير الصفحة" className="press flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-line"><Icon name="minus" size={13} /></button>
          <span>{toAr(Math.round(zoom * 100))}٪</span>
          <button type="button" onClick={() => setZoom((x) => Math.min(1.25, +(x + 0.05).toFixed(2)))} aria-label="تكبير الصفحة" className="press flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-line"><Icon name="plus" size={13} /></button>
        </span>
      </div>

      <div className="mx-auto max-w-[660px]">
        {page.status === 'error' ? <PageError pg={pg} onRetry={page.retry} compact /> : d ? <MushafPage d={d} size={18 * zoom} compact marks={marks} mask={{ visibility, onWord }} /> : <PageSkeleton compact />}
      </div>
      <p className="text-[10.5px] leading-relaxed text-muted">سياق صفحة كامل بالنص الموثّق وتخطيط متدفّق. إخفاء الكلمات يحفظ أبعادها في هذا التخطيط ولا يحرّك الكلمات المحيطة. لا تتوفر بعد مواضع الأسطر والكلمات الثابتة للمصحف المطبوع.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => (audio.a === a ? audio.stop() : audio.play(a, 3))} className="press flex h-10 items-center justify-center gap-1.5 rounded-full bg-night text-[12.5px] font-semibold text-parchment"><Icon name={audio.a === a ? 'pause' : 'play'} size={14} fill />{audio.a === a ? 'إيقاف' : 'استمع وردّد ×٣'}</button>
        <button type="button" onClick={() => setShowTafsir((x) => !x)} className="press flex h-10 items-center justify-center gap-1.5 rounded-full text-[12.5px] ring-1 ring-line"><Icon name="tafsir" size={14} />{showTafsir ? 'أخفِ التفسير' : 'التفسير'}</button>
      </div>
      {showTafsir && <TafsirSnippet s={s} a={a} />}
    </div>
  )
}
