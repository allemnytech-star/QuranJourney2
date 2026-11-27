// Reusable memorization scope selector used by the Mushaf index/reader, Guided start
// and Free memorization. It writes only the guided preview store + shared session;
// plans and historical progress are never modified.
import { useMemo, useState } from 'react'
import { JUZ, SURAHS, surah, toAr } from '../../../lib/quran'
import { Icon, useProto } from '../core'
import { useSession } from '../session'
import { guided, useGuided, type Experience, type Presentation } from './store'
import { scopeChunks, scopeFromAyah, scopeFromSeed, scopeOfAyat, scopeOfJuz, scopeOfPages, scopeOfSurah, scopeSummary, type MemorizationScope, type ScopeSeed } from './scope'

type Choice = 'surah' | 'ayahs' | 'pages' | 'juz'
type AyahChoice = 'single' | 'from' | 'range'

const initialChoice = (seed?: ScopeSeed): Choice => (!seed ? 'ayahs' : seed.kind === 'surah' ? 'surah' : seed.kind === 'page' || seed.kind === 'pages' ? 'pages' : seed.kind === 'juz' ? 'juz' : 'ayahs')
const initialAyahChoice = (seed?: ScopeSeed): AyahChoice => (seed?.kind === 'ayah' ? 'single' : seed?.kind === 'from-ayah' ? 'from' : 'range')

export function MemorizationSelector({ seed, onClose, onSelect }: { seed?: ScopeSeed; onClose: () => void; onSelect?: (scope: MemorizationScope) => void }) {
  const g = useGuided()
  const ses = useSession()
  const { go } = useProto()
  const initial = seed ? scopeFromSeed(seed) : scopeOfAyat(ses.s.passage.s, ses.s.passage.from, ses.s.passage.to)
  const startRef = initial
  const [choice, setChoice] = useState<Choice>(initialChoice(seed))
  const [ayahChoice, setAyahChoice] = useState<AyahChoice>(initialAyahChoice(seed))
  const [s, setS] = useState(startRef.kind === 'surah' || startRef.kind === 'ayahs' ? scopeSummary(startRef).from.s : ses.s.passage.s)
  const seedFrom = seed && 's' in seed ? (seed.kind === 'ayah' || seed.kind === 'from-ayah' ? seed.a : seed.kind === 'ayahs' ? seed.from : 1) : 1
  const seedTo = seed?.kind === 'ayahs' ? seed.to : seed?.kind === 'ayah' ? seed.a : Math.min(surah(s).ayat, seedFrom + 4)
  const [from, setFrom] = useState(seedFrom)
  const [to, setTo] = useState(seedTo)
  const [fromPage, setFromPage] = useState(seed?.kind === 'page' ? seed.page : seed?.kind === 'pages' ? seed.from : startRef.fromPage)
  const [toPage, setToPage] = useState(seed?.kind === 'page' ? seed.page : seed?.kind === 'pages' ? seed.to : startRef.toPage)
  const [juz, setJuz] = useState(seed?.kind === 'juz' ? seed.juz : 1)
  const [experience, setExperience] = useState<Experience>('guided')
  const [presentation, setPresentation] = useState<Presentation>('focus')
  const [replace, setReplace] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const draft = useMemo<MemorizationScope | null>(() => {
    try {
      if (choice === 'surah') return scopeOfSurah(s, 'manual')
      if (choice === 'juz') return scopeOfJuz(juz, 'manual')
      if (choice === 'pages') {
        if (!Number.isInteger(fromPage) || !Number.isInteger(toPage) || fromPage < 1 || toPage < fromPage || toPage > 604) return null
        return scopeOfPages(fromPage, toPage, 'manual')
      }
      if (!Number.isInteger(from) || from < 1 || from > surah(s).ayat) return null
      if (ayahChoice === 'single') return scopeOfAyat(s, from, from, 'manual')
      if (ayahChoice === 'from') return scopeFromAyah(s, from, 'manual')
      if (!Number.isInteger(to) || to < from || to > surah(s).ayat) return null
      return scopeOfAyat(s, from, to, 'manual')
    } catch {
      return null
    }
  }, [choice, s, from, to, fromPage, toPage, juz, ayahChoice])
  const summary = draft && scopeSummary(draft)
  const active = !onSelect && g.session && !g.session.finishedAt ? g.session : null

  const start = () => {
    if (!draft || !summary) return setErr('تحقّق من النطاق المحدّد.')
    if (onSelect) { onSelect(draft); onClose(); return }
    if (active && !replace) return setErr('لديك جلسة غير مكتملة. اختر استئنافها أو أكّد بدء نطاق جديد.')
    if (!guided.startScope(draft, 'daily', g.profile.minutes, presentation, experience)) return setErr('تعذّر بدء هذا النطاق.')
    const first = scopeChunks(draft)[0]
    const chunk = { s: first.s, from: first.from, to: first.to }
    // The guided store is authoritative for the full scope; the legacy shared session
    // follows its current chunk so Free mode and existing panels reuse the same text/actions.
    ses.setPassage(chunk)
    onClose()
    go(experience === 'guided' ? 'guided' : 'ayah')
  }

  const field = 'h-10 rounded-xl bg-card px-3 text-[13px] ring-1 ring-line outline-none focus:ring-2 focus:ring-gold'
  return (
    <div className="absolute inset-0 z-[90] flex items-end justify-center bg-black/35 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={onSelect ? 'اختيار نطاق التسميع' : 'اختيار نطاق الحفظ'} data-memorization-selector>
      <button type="button" aria-label="إغلاق" onClick={onClose} className="absolute inset-0" />
      <div className="relative max-h-[92%] w-full max-w-[620px] overflow-y-auto rounded-[28px] bg-parchment p-5 shadow-[0_30px_70px_-20px_rgba(0,0,0,.5)]">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-gold-soft text-gold"><Icon name="sprout" size={19} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-arabic-display text-[20px] font-bold">{onSelect ? 'اختر نطاق التسميع' : 'ابدأ الحفظ'}</h2>
            <p className="text-[12.5px] text-muted">اختر النطاق كاملًا؛ يُقسَّم داخليًا إلى مقاطع لا تتجاوز ٢٠ آية دون أن يُحذف شيء.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="press flex h-9 w-9 items-center justify-center rounded-full hover:bg-night/[.06]"><Icon name="x" size={16} /></button>
        </div>

        {active && (
          <div className="mt-4 rounded-[18px] bg-gold-soft/60 p-3 text-[12.5px]" data-active-session-warning>
            <p className="font-semibold">لديك جلسة غير مكتملة: {active.scope.label}</p>
            <p className="mt-0.5 text-muted">المقطع {toAr(active.segmentIndex + 1)} من {toAr(scopeSummary(active.scope).chunks)} · البطاقة {toAr(active.idx + 1)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => (onClose(), go(active.experience === 'guided' ? 'guided' : 'ayah'))} className="press h-9 rounded-full bg-night px-3.5 font-semibold text-parchment">استأنف الجلسة</button>
              <button type="button" onClick={() => setReplace(true)} aria-pressed={replace} className={`press h-9 rounded-full px-3.5 ring-1 ${replace ? 'bg-clay/10 text-clay ring-clay/30' : 'ring-line'}`}>{replace ? 'سيُحفَظ القديم في الجلسات المؤرشفة' : 'ابدأ نطاقًا جديدًا بدلًا منها'}</button>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-1 rounded-[14px] bg-night/[.05] p-1 text-[12px]" role="tablist" aria-label="نوع نطاق الحفظ">
          {([['surah', 'سورة'], ['ayahs', 'آيات'], ['pages', 'صفحات'], ['juz', 'جزء']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={choice === k} onClick={() => setChoice(k)} className={`press h-9 rounded-[11px] ${choice === k ? 'bg-card font-semibold shadow-sm' : 'text-muted'}`}>{l}</button>
          ))}
        </div>

        <div className="mt-3 rounded-[18px] bg-card/60 p-3 ring-1 ring-line">
          {choice === 'surah' && (
            <label className="block text-[12px] text-muted">{onSelect ? 'تسميع السورة كاملة' : 'حفظ السورة كاملة'}
              <select value={s} onChange={(e) => setS(Number(e.target.value))} className={`${field} mt-1 w-full`}>{SURAHS.map((x) => <option key={x.n} value={x.n}>{toAr(x.n)}. {x.ar} · {toAr(x.ayat)} آية</option>)}</select>
            </label>
          )}
          {choice === 'ayahs' && (
            <>
              <label className="block text-[12px] text-muted">السورة
                <select value={s} onChange={(e) => { const n = Number(e.target.value); setS(n); setFrom(1); setTo(Math.min(5, surah(n).ayat)) }} className={`${field} mt-1 w-full`}>{SURAHS.map((x) => <option key={x.n} value={x.n}>{toAr(x.n)}. {x.ar}</option>)}</select>
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="طريقة اختيار الآيات">
                {([['single', 'هذه الآية'], ['from', 'ابتداءً من هذه الآية'], ['range', 'مجموعة آيات']] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={ayahChoice === k} onClick={() => setAyahChoice(k)} className={`press h-8 rounded-full px-3 text-[11.5px] ${ayahChoice === k ? 'bg-night text-parchment' : 'ring-1 ring-line'}`}>{l}</button>)}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[12px] text-muted">{ayahChoice === 'single' ? 'الآية' : 'من الآية'}<input type="number" min={1} max={surah(s).ayat} value={from} onChange={(e) => setFrom(Number(e.target.value))} className={`${field} mt-1 w-full text-center`} /></label>
                {ayahChoice === 'range' && <label className="text-[12px] text-muted">إلى الآية<input type="number" min={from} max={surah(s).ayat} value={to} onChange={(e) => setTo(Number(e.target.value))} className={`${field} mt-1 w-full text-center`} /></label>}
              </div>
            </>
          )}
          {choice === 'pages' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[12px] text-muted">من الصفحة<input type="number" min={1} max={604} value={fromPage} onChange={(e) => setFromPage(Number(e.target.value))} className={`${field} mt-1 w-full text-center`} /></label>
              <label className="text-[12px] text-muted">إلى الصفحة<input type="number" min={fromPage} max={604} value={toPage} onChange={(e) => setToPage(Number(e.target.value))} className={`${field} mt-1 w-full text-center`} /></label>
            </div>
          )}
          {choice === 'juz' && (
            <label className="block text-[12px] text-muted">حفظ جزء كامل
              <select value={juz} onChange={(e) => setJuz(Number(e.target.value))} className={`${field} mt-1 w-full`}>{JUZ.map((_, i) => <option key={i} value={i + 1}>الجزء {toAr(i + 1)}</option>)}</select>
            </label>
          )}
        </div>

        {summary ? (
          <div className="mt-3 rounded-[18px] bg-night/[.04] p-3 text-[12.5px]" data-scope-summary data-g0={summary.g0} data-g1={summary.g1}>
            <p className="font-semibold">{summary.label}</p>
            <p className="mt-0.5 text-muted">{summary.range} · {toAr(summary.ayat)} آية · ص {toAr(summary.fromPage)}–{toAr(summary.toPage)} · {toAr(summary.chunks)} مقطع تعلّم</p>
            {choice === 'pages' && summary.from.s !== summary.to.s && <p className="mt-1 text-gold">يعبر هذا النطاق حدود السور بأمان.</p>}
          </div>
        ) : <p role="alert" className="mt-3 text-[12.5px] text-clay">تحقّق من بداية النطاق ونهايته.</p>}

        {!onSelect && <><div className="mt-4 grid grid-cols-2 gap-2">
          <Choice title="التجربة" value={experience} onChange={setExperience} options={[['guided', 'رحلتي الموجّهة'], ['free', 'الحفظ الحر']]} />
          <Choice title="طريقة العرض" value={presentation} onChange={setPresentation} options={[['focus', 'وضع الآية'], ['mushaf', 'وضع المصحف']]} />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">وضع المصحف الحالي سياق صفحة كامل بالنص الموثّق المتدفّق؛ ليس تخطيطًا ثابتًا أصيلًا لغياب بيانات مواضع الكلمات والأسطر المرخّصة.</p></>}
        {err && <p role="alert" className="mt-2 rounded-[12px] bg-clay/10 px-3 py-2 text-[12px] text-clay">{err}</p>}
        <button type="button" onClick={start} disabled={!summary || (!!active && !replace)} className="press mt-4 h-12 w-full rounded-full bg-night text-[14px] font-semibold text-parchment disabled:opacity-40" data-start-memorization>{onSelect ? 'اختر هذا النطاق' : 'ابدأ الحفظ بهذا النطاق'}</button>
      </div>
    </div>
  )
}

function Choice<T extends string>({ title, value, onChange, options }: { title: string; value: T; onChange: (x: T) => void; options: [T, string][] }) {
  return (
    <fieldset className="rounded-[16px] bg-card p-2.5 ring-1 ring-line">
      <legend className="px-1 text-[11.5px] font-semibold text-muted">{title}</legend>
      <div className="space-y-1">
        {options.map(([k, l]) => <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k} className={`press h-8 w-full rounded-[10px] text-[11.5px] ${value === k ? 'bg-gold-soft font-semibold' : 'hover:bg-night/[.04]'}`}>{l}</button>)}
      </div>
    </fieldset>
  )
}
