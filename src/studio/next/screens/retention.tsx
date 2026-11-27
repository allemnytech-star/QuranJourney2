import { RecitationHistory } from '../tilawa/History'
// تثبيت المحفوظ — retention section of the Revision screen (design preview).
//
// Honest by construction: learning states shown are derived only from what the
// learner recorded (session results, confirmed memorisation, revealed words). The
// states that need a scheduler (جارٍ التثبيت / حفظ قوي / حفظ راسخ) and every review
// date are shown as "awaiting the Smart Revision Engine" — never simulated.
import { useMemo, useState, type ReactNode } from 'react'
import { Icon, toAr, useAyahText, useDevice, useProto } from '../core'
import { gIndex, surah, words } from '../../../lib/quran'
import { derived, usePreview } from '../progress'
import { useSession } from '../session'
import { MISTAKE_AR, RETENTION_AR, SUGGESTED_INTERVALS, type RetentionState } from '../learning/contracts'
import { guided, useGuided, type WeakRecord } from '../learning/store'
import { useStartGuided } from './guided'
import { Illustration } from '../illustrations'

export function RetentionPanel() {
  const desk = useDevice() === 'desktop'
  const ses = useSession()
  const pd = derived(usePreview())
  const g = useGuided()
  const start = useStartGuided()
  const { go } = useProto()
  const [msg, setMsg] = useState<string | null>(null)
  // Per-ayah states from the learner's own records only.
  const items = useMemo(() => {
    const out: { s: number; a: number; state: RetentionState }[] = []
    for (const [k, r] of Object.entries(ses.s.mem)) {
      const [s, a] = k.split(':').map(Number)
      if (!surah(s)) continue
      const confirmed = r === 'mastered' || !!pd.mem[gIndex(s, a)]
      out.push({ s, a, state: r === 'shaky' || r === 'forgot' ? 'needs-review' : confirmed ? 'initial' : 'new' })
    }
    return out.sort((x, y) => x.s - y.s || x.a - y.a)
  }, [ses.s.mem, pd.mem])
  const count = (st: RetentionState) => items.filter((x) => x.state === st).length
  const weak = items.filter((x) => x.state === 'needs-review')
  const openWeak = g.weak.filter((w) => !w.reviewed).length
  const states: { id: RetentionState; n: number | null }[] = [
    { id: 'new', n: count('new') },
    { id: 'initial', n: count('initial') + Math.max(0, pd.memCount - items.filter((x) => x.state === 'initial').length) },
    { id: 'consolidating', n: null },
    { id: 'strong', n: null },
    { id: 'established', n: null },
    { id: 'needs-review', n: count('needs-review') },
  ]
  return (
    <section className="mb-8 space-y-4" data-retention>
      <div className="flex items-center gap-4 rounded-[26px] bg-card p-5 ring-1 ring-line">
        <Illustration id="retention" size={desk ? 64 : 52} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold">تثبيت المحفوظ</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">استرجع ما حفظته من ذاكرتك. لا يُعاد ضبط تقدّمك بسبب الانقطاع، ولا عقوبة على مراجعة فاتت.</p>
        </div>
        <button type="button" onClick={() => setMsg(start('quick-review'))} className="press h-11 shrink-0 rounded-full bg-night px-4 text-[13px] font-semibold text-parchment" data-quick-review>تثبيت سريع</button>
      </div>
      {msg && <p role="alert" className="rounded-[14px] bg-clay/10 px-3 py-2 text-[12.5px] text-clay">{msg}</p>}

      <div className={`grid gap-3 ${desk ? 'grid-cols-3' : 'grid-cols-1'}`}>
        <Box title="مراجعات اليوم" icon="calendar">
          <p className="text-[12.5px] text-muted" data-due>محرك المراجعة الذكية غير مفعّل بعد، فلا توجد مواعيد مستحقّة أو متأخّرة أو قادمة محسوبة. المراجعة اليدوية ومهام خططك متاحة أدناه.</p>
        </Box>
        <Box title="حالة الحفظ" icon="layers">
          <ul className="space-y-1 text-[12.5px]">
            {states.map((x) => (
              <li key={x.id} className="flex justify-between gap-2"><span>{RETENTION_AR[x.id]}</span><span className={x.n === null ? 'text-[11px] text-muted' : 'font-semibold tabular-nums'}>{x.n === null ? 'يتطلّب المحرك' : toAr(x.n)}</span></li>
            ))}
          </ul>
          <p className="mt-2 text-[10.5px] text-muted">بلا نسب إتقان رقمية. الحالات من تقييماتك وتأكيداتك فقط.</p>
        </Box>
        <Box title="فواصل المراجعة المقترحة" icon="clock">
          <ol className="flex flex-wrap gap-1 text-[11.5px]">{SUGGESTED_INTERVALS.map((i) => <li key={i.id} className="rounded-full bg-night/[.05] px-2 py-0.5">{i.ar}</li>)}</ol>
          <p className="mt-2 text-[10.5px] leading-relaxed text-muted">قيم ابتدائية قابلة للتعديل، وليست صيغة مضمونة. سيعدّلها المحرك بحسب نتائج استرجاعك الفعلية.</p>
        </Box>
      </div>

      <Box title="مقاطع تحتاج مراجعة" icon="target">
        {weak.length === 0 ? <p className="text-[12.5px] text-muted">لا آيات قيّمتها بـ«أخطأت قليلًا» أو «لم أتذكّرها».</p> : (
          <ul className="flex flex-wrap gap-1.5">
            {weak.map((x) => (
              <li key={`${x.s}:${x.a}`}>
                <button type="button" onClick={() => (ses.setPassage({ s: x.s, from: x.a, to: x.a }), go('ayah'))} className="press h-8 rounded-full bg-gold-soft/70 px-3 text-[12px]">{surah(x.s).ar} {toAr(x.a)}</button>
              </li>
            ))}
          </ul>
        )}
        {weak.length + openWeak >= 5 && <p className="mt-2 text-[12px]">المراجعات كثيرة الآن؛ نقترح تقليل الحفظ الجديد حتى تثبت هذه المواضع.</p>}
      </Box>
      <MistakeHistory />
    </section>
  )
}

function Box({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <div className="rounded-[22px] bg-card p-4 ring-1 ring-line">
      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><Icon name={icon} size={15} className="text-gold" />{title}</p>
      {children}
    </div>
  )
}

type Filter = 'open' | 'reviewed' | 'all'
/** «مواضع تحتاج إلى مراجعة»: the learner's own revealed words, plus the (empty) engine record list. */
export function MistakeHistory() {
  const { production } = useProto()
  const g = useGuided()
  const [src, setSrc] = useState<'self' | 'engine'>('self')
  const [f, setF] = useState<Filter>('open')
  const list = g.weak.filter((w) => (f === 'all' ? true : f === 'open' ? !w.reviewed : !!w.reviewed))
  // Recurring places: same ayah recorded more than once.
  const rec = new Map<string, number>()
  g.weak.forEach((w) => rec.set(`${w.s}:${w.a}`, (rec.get(`${w.s}:${w.a}`) ?? 0) + 1))
  return (
    <div className="rounded-[22px] bg-card p-4 ring-1 ring-line" data-mistakes>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Illustration id="mistakes" size={36} />
        <p className="flex-1 text-[14px] font-semibold">مواضع تحتاج إلى مراجعة</p>
        <div role="tablist" className="inline-flex rounded-full bg-night/[.06] p-1 text-[11.5px]">
          {([['self', 'كلمات أظهرتها'], ['engine', 'من محرك التسميع']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={src === k} onClick={() => setSrc(k)} className={`press h-7 rounded-full px-2.5 ${src === k ? 'bg-card font-semibold shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-muted'}`}>{l}</button>
          ))}
        </div>
      </div>
      {src === 'engine' ? production ? <RecitationHistory /> : (
        <div className="rounded-[16px] border border-dashed border-line p-4 text-[12.5px] text-muted" data-engine-empty>
          لا توجد سجلات من محرك التسميع: المحرك غير مثبّت في هذه النسخة. ستظهر هنا لاحقًا الأنواع التي يدعمها فعلًا ({Object.values(MISTAKE_AR).join('، ')}) مع موضعها الدقيق، ولن يُعرض أي سجل مُختلق.
        </div>
      ) : (
        <>
          <div className="mb-2 flex gap-1.5 text-[11.5px]">
            {([['open', 'لم تُراجَع'], ['reviewed', 'رُوجعت'], ['all', 'الكل']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setF(k)} aria-pressed={f === k} className={`press h-7 rounded-full px-2.5 ${f === k ? 'bg-night text-parchment' : 'ring-1 ring-line'}`}>{l}</button>)}
          </div>
          {list.length === 0 ? (
            <p className="text-[12.5px] text-muted">{g.weak.length === 0 ? 'لا مواضع بعد. حين تُظهر كلمة مخفية أثناء الاسترجاع في الرحلة الموجّهة تُحفظ هنا لتراجعها.' : 'لا شيء في هذا التصنيف.'}</p>
          ) : (
            <ul className="space-y-2">{list.slice(0, 30).map((w) => <WeakRow key={w.id} w={w} repeat={rec.get(`${w.s}:${w.a}`) ?? 1} />)}</ul>
          )}
        </>
      )}
    </div>
  )
}

function WeakRow({ w, repeat }: { w: WeakRecord; repeat: number }) {
  const t = useAyahText(w.s, w.a)
  const ses = useSession()
  const { go } = useProto()
  const ws = t ? words(t.text) : []
  return (
    <li className="rounded-[16px] bg-[var(--mf-paper)] p-3 ring-1 ring-[var(--mf-frame-soft)]" data-weak-row>
      <p className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--mf-ink-soft)]">
        سورة {surah(w.s).ar} · الآية {toAr(w.a)} · {new Date(w.at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}
        {repeat > 1 && <span className="rounded-full bg-gold-soft px-2 py-0.5 text-night">متكرّر ×{toAr(repeat)}</span>}
        {w.reviewed && <span className="rounded-full bg-leaf/12 px-2 py-0.5 text-leaf">رُوجع</span>}
      </p>
      {t ? (
        <p className={`mf-text ${t.hafs ? '' : 'tanzil'} mt-1`} style={{ fontSize: 18, lineHeight: 2 }}>
          {ws.map((x, i) => <span key={i} className={w.words.includes(i) ? 'rounded bg-gold-soft/80 px-0.5' : ''}>{x} </span>)}
        </p>
      ) : <div className="mt-2 h-5 w-3/4 animate-pulse rounded-full bg-night/[.06]" />}
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
        <button type="button" onClick={() => (ses.setPassage({ s: w.s, from: w.a, to: w.a }), go('ayah'))} className="press h-7 rounded-full px-2.5 ring-1 ring-line">افتح الآية</button>
        <button type="button" onClick={() => guided.start({ s: w.s, from: w.a, to: w.a }, 'minute') && go('guided')} className="press h-7 rounded-full px-2.5 ring-1 ring-line">أعد المحاولة</button>
        <button type="button" onClick={() => guided.reviewWeak(w.id)} className="press h-7 rounded-full px-2.5 ring-1 ring-line">{w.reviewed ? 'أعد كغير مُراجَع' : 'تمت مراجعته'}</button>
        <button type="button" onClick={() => guided.deleteWeak(w.id)} className="press h-7 rounded-full px-2.5 text-clay ring-1 ring-clay/30">احذف</button>
      </div>
    </li>
  )
}
