// رحلتي الموجّهة — Guided Smart Feed (design preview).
//
// Evolves the Memorization Journey feed (same CSS scroll-snap + IntersectionObserver
// pattern, same exact-text loader, reference audio and attributed Tafsir from
// ./ayah) into finite learning cards: one objective and one primary action per card.
// The card order is the fixed, documented sequence in ../learning/sequence.ts — not an
// adaptive decision; AdaptiveHifzEngine replaces it later (../learning/contracts.ts).
// Swiping, opening, listening or reading Tafsir never records memorisation; skipped
// cards are recorded as skipped; an ayah is memorised only by explicit confirmation.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Chrome, Head, Icon, toAr, useDevice, useProto } from '../core'
import { chunksOf, actions as progress, usePreview, weekTasks } from '../progress'
import { akey, passageAyat, useSession, type Passage } from '../session'
import { firstLetter, fromGIndex, juzOf, pageOf, surah, words } from '../../../lib/quran'
import { LoadState, TafsirSnippet, textSize, useAudio, useAyat, type Audio } from './ayah'
import { ASSESS_AR, PREFERENCE_AR, PRESET_AR, type CardOutcome, type GuidedCard, type LearningPreference, type RecallOutcome, type SessionPreset } from '../learning/contracts'
import { buildSequence, fitToMinutes, followUps, summarize } from '../learning/sequence'
import { guided, useGuided, type GuidedSession } from '../learning/store'
import { Illustration } from '../illustrations'
import { MemorizationSelector } from '../learning/selector'
import { scopeChunks, scopeOfCanonical, scopeSummary } from '../learning/scope'
import { GuidedMushafView } from './guidedMushaf'

const TYPE_AR: Record<GuidedCard['type'], { ar: string; icon: string; goal: string }> = {
  intro: { ar: 'تمهيد', icon: 'book', goal: 'تعرّف على المقطع' },
  understand: { ar: 'افهم', icon: 'tafsir', goal: 'المعنى العام قبل الحفظ' },
  listen: { ar: 'استمع وردّد', icon: 'volume', goal: 'اسمع التلاوة المرجعية وردّد بعدها' },
  recall: { ar: 'احفظ واسترجع', icon: 'eyeOff', goal: 'استرجع الآية من ذاكرتك' },
  weak: { ar: 'كلمات تحتاج تركيزًا', icon: 'target', goal: 'تدرّب على الكلمات التي احتجت إظهارها' },
  cumulative: { ar: 'اربط ما حفظت', icon: 'layers', goal: 'استرجع الآيات معًا' },
  connect: { ar: 'انتقال الآيات', icon: 'path', goal: 'من نهاية آية إلى بداية التالية' },
  recite: { ar: 'سمّع', icon: 'mic', goal: 'سمّع المقطع كاملًا من حفظك' },
  reflect: { ar: 'تأمّل', icon: 'note', goal: 'تأمّل اختياري' },
  complete: { ar: 'الختام', icon: 'check', goal: 'ما الذي أنجزته فعلًا' },
}
const refAr = (s: number, from: number, to: number) => `سورة ${surah(s).ar} · ${from === to ? `الآية ${toAr(from)}` : `الآيات ${toAr(from)}–${toAr(to)}`}`
const MINUTES = [1, 5, 10, 15, 30, 45, 60]

/** Picks a real passage for a preset from existing records; returns an Arabic reason when none exists. */
export function useStartGuided() {
  const st = usePreview()
  const ses = useSession()
  const g = useGuided()
  const { go } = useProto()
  return (preset: SessionPreset, minutes: number | null = g.profile.minutes): string | null => {
    const p = ses.s.passage
    let target: Passage | null = null
    if (preset === 'daily') {
      const t = weekTasks(st).find((d) => d.today)?.tasks.find((x) => x.activity === 'hifz' && x.state === 'open' && x.g0 != null && x.g1 != null)
      if (t?.g0 != null && t.g1 != null) {
        if (!guided.startScope(scopeOfCanonical(t.g0, t.g1, `مهمة اليوم · ${t.plan.name}`, 'plan'), preset, minutes, 'focus', 'guided')) return 'تعذّر بدء مهمة اليوم.'
        go('guided')
        return null
      }
      target = p
    } else if (preset === 'five') target = p
    else if (preset === 'tadabbur-moment') target = { s: p.s, from: ses.s.cur, to: ses.s.cur }
    else if (preset === 'minute') {
      const mem = st.memorized
      if (mem.length) {
        const r = mem[new Date().getDate() % mem.length]
        const [s, a] = fromGIndex(r.from)
        target = { s, from: a, to: a }
      } else target = { s: p.s, from: ses.s.cur, to: ses.s.cur }
    } else {
      const known = passageAyat(p).filter((a) => ses.s.mem[akey(p.s, a)])
      const rec = st.memorized[0]
      const self = g.profile.selfReported[0]
      if (known.length) target = { s: p.s, from: known[0], to: known[known.length - 1] }
      else if (rec) {
        const c = chunksOf(rec.from, rec.to)[0]
        target = { s: c.s, from: c.from, to: c.to }
      } else if (self) target = { s: self.s, from: self.from, to: Math.min(self.to, self.from + 19) }
    }
    if (!target) return 'لا يوجد محفوظ مسجّل بعد. احفظ مقطعًا أولًا، أو أضف ما تحفظه سابقًا من الإعدادات.'
    if (!guided.start(target, preset, minutes)) return 'تعذّر بدء الجلسة لهذا المقطع.'
    go('guided')
    return null
  }
}

export function GuidedFeed() {
  const g = useGuided()
  const s = g.session
  if (!s || s.finishedAt) return <GuidedStart last={s?.finishedAt ? s : null} />
  return <GuidedRun key={s.id} gs={s} />
}

// ------------------------------------------------------------------ start
function GuidedStart({ last }: { last: GuidedSession | null }) {
  const desk = useDevice() === 'desktop'
  const { go } = useProto()
  const g = useGuided()
  const ses = useSession()
  const start = useStartGuided()
  const [msg, setMsg] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  const [custom, setCustom] = useState('')
  const p = ses.s.passage
  const needs = passageAyat(p).filter((a) => ['shaky', 'forgot'].includes(ses.s.mem[akey(p.s, a)] ?? '')).length + g.weak.filter((w) => !w.reviewed).length
  const run = (x: SessionPreset) => setMsg(start(x))
  return (
    <Chrome>
      <div className={desk ? 'no-scrollbar mx-auto h-full max-w-[920px] overflow-y-auto px-10 py-9' : 'relative px-5 pb-8 pt-4'} data-guided-start>
        <Head title="رحلتي الموجّهة" sub="جلسة قصيرة محدّدة الهدف: بطاقة واحدة، هدف واحد، خطوة واحدة. لا حاجة لتختار التمرين التالي بنفسك." />
        {last && <LastSummary s={last} />}
        <section className="rounded-[26px] bg-card p-5 ring-1 ring-line">
          <div className="flex items-center gap-4">
            <Illustration id="guided" size={desk ? 72 : 60} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-muted">المقطع اليدوي الحالي</p>
              <p className="text-[16px] font-semibold" data-guided-passage>{refAr(p.s, p.from, p.to)}</p>
              <button type="button" onClick={() => setPicker(true)} className="press mt-1 text-[12.5px] font-semibold text-gold underline">اختر سورة أو آيات أو صفحات أو جزءًا</button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => run('daily')} className="press flex h-13 items-center justify-center gap-2 rounded-full bg-night py-3.5 text-[14px] font-semibold text-parchment" data-start-daily>
              <Icon name="calendar" size={17} />ابدأ مهمة اليوم المجدولة
            </button>
            <button type="button" onClick={() => setPicker(true)} className="press flex h-13 items-center justify-center gap-2 rounded-full bg-gold py-3.5 text-[14px] font-semibold text-white" data-start-manual>
              <Icon name="sprout" size={17} />اختر ما تريد حفظه
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">المهمة المجدولة تستخدم خطة اليوم. الاختيار اليدوي يستخدم النطاق الذي تؤكّده أنت ولا تستبدله الخطة.</p>
          {msg && <p role="alert" className="mt-3 rounded-[14px] bg-clay/10 px-3 py-2 text-[12.5px] text-clay">{msg}</p>}
          {needs >= 5 && <p className="mt-3 rounded-[14px] bg-gold-soft/60 px-3 py-2 text-[12.5px]">لديك {toAr(needs)} مواضع تحتاج مراجعة. نقترح تقليل الحفظ الجديد اليوم والبدء بـ«تثبيت سريع».</p>}
        </section>

        <h2 className="mb-3 mt-7 text-[14px] font-semibold">جلسات قصيرة</h2>
        <div className={`grid gap-2.5 ${desk ? 'grid-cols-4' : 'grid-cols-2'}`}>
          {(['minute', 'five', 'quick-review', 'tadabbur-moment'] as const).map((k) => (
            <button key={k} type="button" onClick={() => run(k)} className="press flex flex-col items-start gap-2 rounded-[22px] bg-card p-4 text-start ring-1 ring-line hover:ring-gold/50" data-preset={k}>
              <Illustration id={k === 'minute' ? 'minute' : k === 'five' ? 'free' : k === 'quick-review' ? 'retention' : 'tadabbur'} size={40} />
              <span className="text-[13.5px] font-semibold">{PRESET_AR[k].ar}</span>
              <span className="text-[11.5px] leading-snug text-muted">{PRESET_AR[k].sub}</span>
            </button>
          ))}
        </div>

        <h2 className="mb-2 mt-7 text-[14px] font-semibold">وقتك المتاح اليوم</h2>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="الوقت المتاح">
          {MINUTES.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={g.profile.minutes === m} onClick={() => guided.setProfile({ minutes: m })} className={`press h-9 rounded-full px-3.5 text-[12.5px] ${g.profile.minutes === m ? 'bg-night font-semibold text-parchment' : 'bg-card ring-1 ring-line'}`}>
              {m === 1 ? 'دقيقة' : `${toAr(m)} د`}
            </button>
          ))}
          <label className="flex h-9 items-center gap-1 rounded-full bg-card px-3 text-[12px] ring-1 ring-line">مدة أخرى
            <input type="number" min={1} max={240} value={custom} onChange={(e) => setCustom(e.target.value)} onBlur={() => Number(custom) > 0 && Number(custom) <= 240 && guided.setProfile({ minutes: Math.round(Number(custom)) })} aria-label="مدة مخصّصة بالدقائق" className="w-12 bg-transparent text-center outline-none" />
          </label>
        </div>
        <p className="mt-2 text-[11.5px] text-muted">تُستخدم المدة لاختيار عدد البطاقات تقريبيًا فقط؛ لا نعد بحفظ عدد معيّن من الآيات في مدة معيّنة.</p>

        <h2 className="mb-2 mt-7 text-[14px] font-semibold">طريقتك في الحفظ</h2>
        <div className={`grid gap-2 ${desk ? 'grid-cols-4' : 'grid-cols-2'}`} role="radiogroup" aria-label="تفضيل التعلّم">
          {(Object.keys(PREFERENCE_AR) as LearningPreference[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={g.profile.preference === k} onClick={() => guided.setProfile({ preference: k })} className={`press rounded-[18px] p-3 text-start ${g.profile.preference === k ? 'bg-gold-soft ring-2 ring-gold/60' : 'bg-card ring-1 ring-line'}`}>
              <span className="block text-[13px] font-semibold">{PREFERENCE_AR[k].ar}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted">{PREFERENCE_AR[k].sub}</span>
            </button>
          ))}
        </div>

        <h2 className="mb-2 mt-7 text-[14px] font-semibold">تجارب أخرى</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => go('ayah')} className="press flex items-center gap-3 rounded-[20px] bg-card p-3.5 text-start ring-1 ring-line"><Illustration id="free" size={40} /><span><span className="block text-[13.5px] font-semibold">الحفظ الحر</span><span className="block text-[11.5px] text-muted">تصفّح الآيات واختر تمارينك</span></span></button>
          <button type="button" onClick={() => go('revision')} className="press flex items-center gap-3 rounded-[20px] bg-card p-3.5 text-start ring-1 ring-line"><Illustration id="retention" size={40} /><span><span className="block text-[13.5px] font-semibold">تثبيت المحفوظ</span><span className="block text-[11.5px] text-muted">المراجعة ومواضع الضعف</span></span></button>
        </div>
        {picker && <MemorizationSelector onClose={() => setPicker(false)} />}
      </div>
    </Chrome>
  )
}

function LastSummary({ s }: { s: GuidedSession }) {
  const seq = followUps(fitToMinutes(buildSequence(s.passage, s.preference, s.preset), s.minutes), s.done)
  const sum = summarize(seq, s.done)
  return (
    <div className="mb-5 flex items-center gap-3 rounded-[20px] bg-leaf/[.08] p-4 text-[13px]" data-last-summary>
      <Icon name="check" size={18} className="text-leaf" />
      <p className="flex-1">آخر جلسة: {refAr(s.passage.s, s.passage.from, s.passage.to)} · {toAr(sum.practiced)} خطوة منجزة{sum.skipped ? ` · ${toAr(sum.skipped)} مؤجّلة` : ''}</p>
      <button type="button" onClick={guided.discard} className="text-[12px] text-muted underline">إخفاء</button>
    </div>
  )
}

// ------------------------------------------------------------------ run
function GuidedRun({ gs }: { gs: GuidedSession }) {
  const desk = useDevice() === 'desktop'
  const { go } = useProto()
  const p = gs.passage
  const chunks = scopeChunks(gs.scope)
  const scope = scopeSummary(gs.scope)
  const seq = useMemo(() => followUps(fitToMinutes(buildSequence(p, gs.preference, gs.preset), gs.minutes), gs.done), [p, gs.preference, gs.preset, gs.minutes, gs.done])
  const idx = Math.min(gs.idx, seq.length - 1)
  const text = useAyat(p)
  const audio = useAudio(p.s)
  const ayah = (a: number) => (text.status === 'ready' ? (text.ayat[a - p.from] ?? '') : '')

  // Feed ↔ shared index: the frame being scrolled drives it, the other frame follows.
  const feed = useRef<HTMLDivElement>(null)
  const shown = useRef<number | null>(null)
  const quiet = useRef(0)
  const jump = (i: number, smooth = false) => {
    const root = feed.current
    if (!root) return
    quiet.current = Date.now() + (smooth ? 800 : 200)
    shown.current = i
    root.scrollTo({ top: i * root.clientHeight, behavior: smooth ? 'smooth' : 'auto' })
  }
  useLayoutEffect(() => {
    const root = feed.current
    if (!root) return
    jump(idx)
    let later: ReturnType<typeof setTimeout> | undefined
    const reconcile = () => {
      const wait = quiet.current - Date.now()
      if (wait > 0) return (clearTimeout(later), (later = setTimeout(reconcile, wait + 40)))
      const i = Math.round(root.scrollTop / Math.max(1, root.clientHeight))
      shown.current = i
      guided.setIdx(i)
    }
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && reconcile(), { root, threshold: 0.6 })
    root.querySelectorAll('[data-card]').forEach((n) => io.observe(n))
    return () => (io.disconnect(), clearTimeout(later))
  }, [seq.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (shown.current !== idx) jump(idx)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps
  const move = (i: number) => {
    const n = Math.max(0, Math.min(seq.length - 1, i))
    guided.setIdx(n)
    jump(n, true)
  }
  const record = (c: GuidedCard, o: Omit<CardOutcome, 'at'>) => guided.record(c.id, o)
  const skip = (c: GuidedCard) => (record(c, { status: 'skipped' }), move(idx + 1))
  const pause = () => (audio.stop(), guided.pause(), go('home'))

  const doneCount = seq.filter((c) => gs.done[c.id]?.status === 'done').length
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('textarea,input')) return
    if (e.key === 'ArrowDown' || e.key === 'PageDown') (e.preventDefault(), move(idx + 1))
    if (e.key === 'ArrowUp' || e.key === 'PageUp') (e.preventDefault(), move(idx - 1))
  }

  const slides = seq.map((c, i) => (
    <section key={c.id} data-card={c.type} aria-label={`البطاقة ${i + 1} من ${seq.length}: ${TYPE_AR[c.type].ar}`} className={`flex h-full snap-start snap-always flex-col ${desk ? 'justify-center px-12 py-8' : 'px-5 pb-32 pt-[220px]'}`}>
      <div className={`no-scrollbar mx-auto w-full overflow-y-auto ${desk ? 'max-w-[720px]' : ''}`}>
        <p className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-2.5 py-1 font-semibold text-night"><Icon name={TYPE_AR[c.type].icon} size={13} />{TYPE_AR[c.type].ar}</span>
          {c.type !== 'intro' && c.type !== 'complete' && refAr(c.s, c.from, c.to)}
          {c.optional && <span className="rounded-full bg-night/[.05] px-2 py-0.5">اختياري</span>}
        </p>
        <h2 className={`font-arabic-display font-bold ${desk ? 'text-[26px]' : 'text-[21px]'}`}>{TYPE_AR[c.type].goal}</h2>
        {c.reason && <p className="mt-1 text-[12px] text-muted">{c.reason}</p>}
        <div className="mt-4">
          {text.status !== 'ready' && c.type !== 'intro' ? (
            <LoadState status={text.status} retry={text.retry} />
          ) : gs.presentation === 'mushaf' ? (
            <div>
              <GuidedMushafView s={c.s} a={c.from} />
              <button type="button" onClick={() => guided.setPresentation('focus')} className="press mt-3 h-10 w-full rounded-full bg-gold-soft text-[12.5px] font-semibold">أكمل نشاط «{TYPE_AR[c.type].ar}» في وضع الآية</button>
            </div>
          ) : (
            <CardBody c={c} gs={gs} seq={seq} ayah={ayah} hafs={text.hafs} audio={audio} active={i === idx} onRecord={(o) => record(c, o)} onNext={() => move(i + 1)} />
          )}
        </div>
        {c.type !== 'complete' && (
          <div className="mt-5 flex items-center justify-between gap-2">
            <button type="button" onClick={() => skip(c)} className="press h-10 rounded-full px-4 text-[12.5px] text-muted ring-1 ring-line" data-skip>{c.optional ? 'تخطَّ' : 'أجّل هذه الخطوة'}</button>
            {gs.done[c.id] && <span className="text-[11.5px] text-muted">{gs.done[c.id].status === 'done' ? `سُجّل${gs.done[c.id].recall ? `: ${ASSESS_AR[gs.done[c.id].recall!]}` : ''}` : 'مؤجّلة · لم تُحتسب'}</span>}
          </div>
        )}
      </div>
    </section>
  ))

  const bar = (
    <div className="flex items-center gap-3">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-night/10" role="progressbar" aria-label="تقدّم الجلسة" aria-valuemin={0} aria-valuemax={seq.length} aria-valuenow={idx + 1}>
        <span className="block h-full rounded-full bg-gold transition-[width]" style={{ width: `${((idx + 1) / seq.length) * 100}%` }} />
      </span>
      <span className="text-[12px] tabular-nums text-muted" data-card-pos>{toAr(idx + 1)} / {toAr(seq.length)}</span>
    </div>
  )
  const viewSwitch = (
    <div role="radiogroup" aria-label="طريقة عرض الحفظ" className="inline-flex rounded-full bg-night/[.06] p-1 text-[11.5px]" data-presentation-switch>
      {([['focus', 'وضع الآية', 'layers'], ['mushaf', 'وضع المصحف', 'book']] as const).map(([k, l, icon]) => (
        <button key={k} type="button" role="radio" aria-checked={gs.presentation === k} onClick={() => guided.setPresentation(k)} className={`press flex h-8 items-center gap-1 rounded-full px-3 ${gs.presentation === k ? 'bg-card font-semibold shadow-sm' : 'text-muted'}`}><Icon name={icon} size={13} />{l}</button>
      ))}
    </div>
  )
  const scopeBar = (
    <div className="flex flex-wrap items-center gap-2 rounded-[14px] bg-gold-soft/45 px-3 py-2 text-[11.5px]" data-scope-progress>
      <span className="min-w-0 flex-1"><b>{scope.label}</b> · المقطع {toAr(gs.segmentIndex + 1)} من {toAr(chunks.length)} · {toAr(Object.keys(gs.segmentResults).length)} مقاطع ممارَسة</span>
      <select aria-label="مقاطع نطاق الحفظ" value={gs.segmentIndex} onChange={(e) => guided.setSegment(Number(e.target.value))} className="h-8 max-w-[260px] rounded-full bg-card px-3 ring-1 ring-line">
        {chunks.map((x, i) => <option key={x.id} value={i}>{gs.segmentResults[x.id] ? '✓ ' : ''}المقطع {toAr(i + 1)} · {surah(x.s).ar} {toAr(x.from)}–{toAr(x.to)}</option>)}
      </select>
    </div>
  )
  const navBtns = (
    <div className="flex gap-2">
      <button type="button" onClick={() => move(idx - 1)} disabled={idx === 0} aria-label="البطاقة السابقة" className="press glass-panel flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-35" data-prev><Icon name="chevron" className="-rotate-90" /></button>
      <button type="button" onClick={() => move(idx + 1)} disabled={idx === seq.length - 1} aria-label="البطاقة التالية" className="press glass-panel flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-35" data-next><Icon name="chevron" className="rotate-90" /></button>
    </div>
  )
  const feedEl = (
    <div ref={feed} tabIndex={0} onKeyDown={onKey} aria-label="بطاقات الجلسة · استخدم الأسهم للتنقّل" className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto outline-none" data-guided-feed>{slides}</div>
  )

  if (desk)
    return (
      <Chrome>
        <div className="flex h-full">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-4 border-b border-line/60 px-8 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-arabic-display text-[19px] font-bold">رحلتي الموجّهة · {PRESET_AR[gs.preset].ar}</p>
                <p className="text-[12.5px] text-muted">{refAr(p.s, p.from, p.to)} · {PREFERENCE_AR[gs.preference].ar}</p>
              </div>
              {viewSwitch}
              <button type="button" onClick={pause} className="press flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] ring-1 ring-line" data-pause><Icon name="pause" size={14} />أوقف مؤقتًا</button>
            </div>
            <div className="space-y-2 px-8 pt-3">{scopeBar}{bar}</div>
            <div className="relative min-h-0 flex-1">
              {feedEl}
              <div className="absolute bottom-5 start-5">{navBtns}</div>
            </div>
          </div>
          <aside className="no-scrollbar w-[300px] shrink-0 overflow-y-auto border-s border-line/60 bg-card/50 p-5" aria-label="مخطط الجلسة">
            <p className="mb-1 text-[13px] font-semibold">مخطط الجلسة</p>
            <p className="mb-3 text-[11.5px] leading-relaxed text-muted">ترتيب ثابت موثّق (ليس قرارًا ذكيًا بعد). بطاقة «كلمات تحتاج تركيزًا» تُضاف فقط حين تختار أنك احتجت مساعدة.</p>
            <ol className="space-y-1">
              {seq.map((c, i) => {
                const o = gs.done[c.id]
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => move(i)} aria-current={i === idx ? 'step' : undefined} className={`press flex w-full items-center gap-2 rounded-[12px] px-2.5 py-1.5 text-start text-[12px] ${i === idx ? 'bg-gold-soft font-semibold' : 'hover:bg-night/[.04]'}`}>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${o?.status === 'done' ? 'bg-leaf text-white' : o ? 'bg-night/15 text-muted' : 'bg-night/[.06] text-muted'}`}>{o?.status === 'done' ? <Icon name="check" size={11} /> : toAr(i + 1)}</span>
                      <span className="min-w-0 flex-1 truncate">{TYPE_AR[c.type].ar}{c.type !== 'intro' && c.type !== 'complete' ? ` · ${c.from === c.to ? toAr(c.from) : `${toAr(c.from)}–${toAr(c.to)}`}` : ''}</span>
                      {o && o.status !== 'done' && <span className="text-[10px] text-muted">مؤجّلة</span>}
                    </button>
                  </li>
                )
              })}
            </ol>
            <p className="mt-4 text-[11.5px] text-muted">{toAr(doneCount)} خطوة منجزة من {toAr(seq.length)}</p>
          </aside>
        </div>
      </Chrome>
    )
  return (
    <Chrome bare dock={false}>
      <div className="relative h-full">
        {feedEl}
        <div className="glass-panel absolute inset-x-0 top-0 z-30 px-4 pb-3 pt-12" style={{ borderRadius: 0 }}>
          <div className="flex items-center gap-2">
            <button type="button" onClick={pause} aria-label="أوقف مؤقتًا واخرج · يُحفظ تقدّمك" className="press flex h-10 w-10 items-center justify-center rounded-full hover:bg-night/5" data-pause><Icon name="x" /></button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-[14.5px] font-semibold">{PRESET_AR[gs.preset].ar}</p>
              <p className="truncate text-[11.5px] text-muted">{refAr(p.s, p.from, p.to)}</p>
            </div>
            <span className="w-10" />
          </div>
          <div className="mt-2">{bar}</div>
          <div className="mt-2 flex justify-center">{viewSwitch}</div>
          <div className="mt-2">{scopeBar}</div>
        </div>
        <div className="absolute bottom-7 start-4 z-30">{navBtns}</div>
      </div>
    </Chrome>
  )
}

// ------------------------------------------------------------------ cards
type BodyProps = { c: GuidedCard; gs: GuidedSession; seq: GuidedCard[]; ayah: (a: number) => string; hafs: boolean; audio: Audio; active: boolean; onRecord: (o: Omit<CardOutcome, 'at'>) => void; onNext: () => void }

function Primary({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="press mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-night text-[14px] font-semibold text-parchment disabled:opacity-40" data-primary>{children}</button>
}
function AyahText({ s, a, t, hafs, size }: { s: number; a: number; t: string; hafs: boolean; size?: number }) {
  const desk = useDevice() === 'desktop'
  return (
    <div className="mf-paper rounded-[22px] px-5 py-5">
      <p className={`mf-text ${hafs ? '' : 'tanzil'}`} style={{ fontSize: size ?? textSize(t, desk) * 0.8, lineHeight: 2.1, textAlignLast: 'center' }} aria-label={`سورة ${surah(s).ar} الآية ${a}`}>
        {t} <span className="mf-num">{toAr(a)}</span>
      </p>
    </div>
  )
}

function CardBody(props: BodyProps) {
  const { c, gs, seq, ayah, hafs, audio, onRecord, onNext } = props
  const done = (extra: Partial<CardOutcome> = {}) => (onRecord({ status: 'done', ...extra }), onNext())
  switch (c.type) {
    case 'intro': {
      const counts = seq.reduce<Record<string, number>>((m, x) => ((m[x.type] = (m[x.type] ?? 0) + 1), m), {})
      return (
        <div>
          <div className="rounded-[22px] bg-card p-4 ring-1 ring-line">
            <p className="text-[16px] font-semibold">{refAr(c.s, c.from, c.to)}</p>
            <p className="mt-1 text-[12.5px] text-muted">الجزء {toAr(juzOf(c.s, c.from))} · الصفحة {toAr(pageOf(c.s, c.from))} · {toAr(c.to - c.from + 1)} {c.to - c.from + 1 > 2 ? 'آيات' : 'آية'}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
              {Object.entries(counts).filter(([k]) => k !== 'intro' && k !== 'complete').map(([k, n]) => <li key={k} className="rounded-full bg-night/[.05] px-2.5 py-1">{TYPE_AR[k as GuidedCard['type']].ar} × {toAr(n)}</li>)}
            </ul>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">القراءة والاستماع والتفسير تعينك على الحفظ لكنها لا تُسجَّل حفظًا. تُسجَّل الآية محفوظة فقط حين تؤكّد ذلك بنفسك في ختام الجلسة.</p>
          <Primary onClick={() => done()}>ابدأ</Primary>
        </div>
      )
    }
    case 'understand':
      return (
        <div>
          <AyahText s={c.s} a={c.from} t={ayah(c.from)} hafs={hafs} />
          <p className="mb-1 mt-4 text-[12px] font-semibold text-muted">المعنى الموجز</p>
          <TafsirSnippet s={c.s} a={c.from} />
          <p className="mt-2 text-[11.5px] text-muted">معاني الكلمات المفردة: لا يتوفّر مصدر موثّق مضمّن بعد، فلا نعرض معاني غير موثّقة.</p>
          <Primary onClick={() => done()}>فهمت المعنى العام</Primary>
        </div>
      )
    case 'listen':
      return <ListenBody {...props} />
    case 'recall':
    case 'weak':
      return <RecallBody key={c.id} {...props} />
    case 'cumulative':
    case 'recite':
      return <MultiRecall key={c.id} {...props} />
    case 'connect':
      return <ConnectBody key={c.id} {...props} />
    case 'reflect':
      return <ReflectBody {...props} />
    case 'complete':
      return <Completion gs={gs} seq={seq} />
  }
  void audio
}

function ListenBody({ c, ayah, hafs, audio, onRecord, onNext }: BodyProps) {
  const [reps, setReps] = useState(3)
  const playing = audio.a === c.from
  return (
    <div>
      <AyahText s={c.s} a={c.from} t={ayah(c.from)} hafs={hafs} />
      <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-card p-3 ring-1 ring-line">
        <button type="button" onClick={() => (playing ? audio.stop() : audio.play(c.from, reps))} className="press flex h-12 w-12 items-center justify-center rounded-full bg-gold text-white" aria-label={playing ? 'إيقاف' : `استمع ${reps} مرات`} data-listen>
          <Icon name={playing ? 'pause' : 'play'} size={18} fill />
        </button>
        <div className="flex-1 text-[12.5px]">
          <p className="font-semibold">{playing ? (audio.busy ? 'جارٍ التحميل…' : `يُتلى · متبقٍّ ${toAr(audio.left)}`) : 'التلاوة المرجعية'}</p>
          <p className="text-muted">المنشاوي · EveryAyah</p>
        </div>
        <div className="flex items-center gap-1" aria-label="عدد التكرار">
          <button type="button" onClick={() => setReps((r) => Math.max(1, r - 1))} aria-label="أقل" className="press flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-line"><Icon name="minus" size={14} /></button>
          <span className="w-9 text-center text-[13px] font-semibold tabular-nums">×{toAr(reps)}</span>
          <button type="button" onClick={() => setReps((r) => Math.min(10, r + 1))} aria-label="أكثر" className="press flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-line"><Icon name="plus" size={14} /></button>
        </div>
      </div>
      <p className="mt-2 text-[11.5px] text-muted">تكرار جزء من آية طويلة غير متاح: لا توجد توقيتات مقاطع ومواضع وقف موثّقة في المشروع، فنكرّر الآية كاملة.</p>
      <Primary onClick={() => (audio.stop(), onRecord({ status: 'done' }), onNext())}>استمعت وردّدت</Primary>
    </div>
  )
}

type Mode = 'visible' | 'partial' | 'hidden'
const MODE_AR: Record<Mode, string> = { visible: 'النص ظاهر', partial: 'إخفاء جزئي', hidden: 'التسميع من الحفظ' }

/** Active recall on one ayah: progressive hiding, graduated hints (first letter → word), self-assessment. */
function RecallBody({ c, gs, ayah, hafs, onRecord, onNext }: BodyProps) {
  const ws = useMemo(() => words(ayah(c.from)), [ayah, c.from])
  // Weak card: hide only the words this learner revealed earlier in the session for this ayah.
  const focus = useMemo(() => {
    if (c.type !== 'weak') return null
    const prev = Object.entries(gs.done).filter(([id, o]) => id.startsWith(`recall`) && id.includes(`:${c.s}:${c.from}`) && o.revealed?.length)
    return new Set(prev.flatMap(([, o]) => o.revealed!))
  }, [c, gs.done])
  const [mode, setMode] = useState<Mode>(c.id.startsWith('recall2') ? 'hidden' : 'partial')
  const [lvl, setLvl] = useState<Record<number, 1 | 2>>({})
  const [assessed, setAssessed] = useState<RecallOutcome | null>(gs.done[c.id]?.recall ?? null)
  const hidden = (i: number) => (focus ? focus.has(i) || (focus.size === 0 && mode !== 'visible') : mode === 'visible' ? false : mode === 'partial' ? (i * 7) % 10 < 5 : true)
  const hints = Object.keys(lvl).length
  const tap = (i: number) => setLvl((x) => ({ ...x, [i]: x[i] ? 2 : 1 }))
  const revealNext = () => {
    const i = ws.findIndex((_, j) => hidden(j) && lvl[j] !== 2)
    if (i >= 0) setLvl((x) => ({ ...x, [i]: 2 }))
  }
  const assess = (r: RecallOutcome) => {
    const revealed = Object.keys(lvl).map(Number)
    setAssessed(r)
    onRecord({ status: 'done', recall: r, hintsUsed: hints, revealed })
    if (revealed.length) guided.addWeak(c.s, c.from, revealed)
  }
  return (
    <div>
      {!focus && (
        <div role="radiogroup" aria-label="إظهار النص" className="mb-3 inline-flex rounded-full bg-night/[.06] p-1 text-[12px]">
          {(Object.keys(MODE_AR) as Mode[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => (setMode(m), setLvl({}))} className={`press h-8 rounded-full px-3 ${mode === m ? 'bg-card font-semibold shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-muted'}`}>{MODE_AR[m]}</button>
          ))}
        </div>
      )}
      {focus && <p className="mb-3 text-[12px] text-muted">{focus.size ? `${toAr(focus.size)} كلمات أظهرتها سابقًا مخفية الآن؛ بقية الآية ظاهرة.` : 'لم تُظهر كلمات بعينها؛ الآية كلها مخفية لمحاولة ثانية.'}</p>}
      <div className="mf-paper rounded-[22px] px-5 py-5">
        <p className={`mf-text ${hafs ? '' : 'tanzil'}`} style={{ fontSize: 24, lineHeight: 2.2, textAlignLast: 'center' }}>
          {ws.map((w, i) => (
            <span key={i}>
              {hidden(i) && lvl[i] !== 2 ? (
                <button type="button" onClick={() => tap(i)} className="mx-0.5 inline-block min-w-[2.2em] rounded-md border-b-2 border-dashed border-gold/60 bg-gold-soft/40 px-1 align-baseline" aria-label={lvl[i] ? 'أظهر الكلمة كاملة' : 'تلميح: أول حرف'} data-hidden-word>
                  <span className={lvl[i] === 1 ? 'text-gold' : 'invisible'}>{lvl[i] === 1 ? `${firstLetter(w)}…` : w}</span>
                </button>
              ) : (
                <span className={lvl[i] === 2 ? 'rounded bg-gold-soft/50' : ''}>{w}</span>
              )}{' '}
            </span>
          ))}
          <span className="mf-num">{toAr(c.from)}</span>
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
        <button type="button" onClick={revealNext} className="press h-9 rounded-full px-3.5 ring-1 ring-line" data-reveal-next>أظهر الكلمة التالية</button>
        <button type="button" onClick={() => setLvl({})} className="press h-9 rounded-full px-3.5 ring-1 ring-line">أعد المحاولة</button>
        <span className="text-muted">اضغط كلمة مخفية: أول حرف، ثم الكلمة · تلميحات مستخدمة: {toAr(hints)}</span>
      </div>
      <Assess value={assessed} onPick={assess} />
      {assessed && <Primary onClick={onNext}>التالي</Primary>}
    </div>
  )
}

function Assess({ value, onPick }: { value: RecallOutcome | null; onPick: (r: RecallOutcome) => void }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[12.5px] text-muted">كيف كان استرجاعك؟ تقييمك وحده يحدّد ما يُسجَّل؛ لا يُحتسب حفظًا بعد.</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="تقييم الاسترجاع">
        {(Object.keys(ASSESS_AR) as RecallOutcome[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onPick(k)} className={`press rounded-2xl py-2.5 text-[12.5px] font-semibold ${k === 'independent' ? 'bg-leaf/12 text-leaf' : k === 'unable' ? 'bg-night/[.06]' : 'bg-gold-soft/70'} ${value === k ? 'ring-2 ring-night/40' : ''}`} data-assess={k}>{ASSESS_AR[k]}</button>
        ))}
      </div>
    </div>
  )
}

/** Several ayat from memory (cumulative group or full passage): each ayah hidden, revealable and retryable. */
function MultiRecall({ c, gs, ayah, hafs, onRecord, onNext }: BodyProps) {
  const ayat = Array.from({ length: c.to - c.from + 1 }, (_, i) => c.from + i)
  const [st, setSt] = useState<Record<number, 'hint' | 'shown'>>({})
  const [assessed, setAssessed] = useState<RecallOutcome | null>(gs.done[c.id]?.recall ?? null)
  const hints = Object.keys(st).length
  const { go } = useProto()
  return (
    <div>
      <p className="mb-3 text-[12.5px] text-muted">{c.type === 'recite' ? 'النص مخفي. سمّع المقطع من حفظك بصوتك أو في سرّك، وأظهر ما تحتاجه فقط.' : 'سمّع هذه الآيات متتابعة من حفظك.'}</p>
      <ol className="space-y-2">
        {ayat.map((a) => {
          const t = ayah(a)
          const s = st[a]
          return (
            <li key={a} className="mf-paper rounded-[18px] px-4 py-3">
              {s === 'shown' ? (
                <p className={`mf-text ${hafs ? '' : 'tanzil'}`} style={{ fontSize: 20, lineHeight: 2.05 }}>{t} <span className="mf-num">{toAr(a)}</span></p>
              ) : (
                <p className="flex items-center gap-2 text-[13px] text-[var(--mf-ink-soft)]">
                  <span className="mf-num">{toAr(a)}</span>
                  {s === 'hint' ? <span className={`mf-text ${hafs ? '' : 'tanzil'}`} style={{ fontSize: 19 }}>{words(t)[0]} …</span> : <span>الآية مخفية</span>}
                </p>
              )}
              <div className="mt-1.5 flex gap-1.5 text-[11.5px]">
                {s !== 'shown' && <button type="button" onClick={() => setSt((x) => ({ ...x, [a]: s === 'hint' ? 'shown' : 'hint' }))} className="press h-7 rounded-full px-2.5 ring-1 ring-[var(--mf-frame-soft)]">{s === 'hint' ? 'أظهر الآية' : 'أول كلمة'}</button>}
                {s && <button type="button" onClick={() => setSt((x) => { const n = { ...x }; delete n[a]; return n })} className="press h-7 rounded-full px-2.5 ring-1 ring-[var(--mf-frame-soft)]">أعد المحاولة</button>}
              </div>
            </li>
          )
        })}
      </ol>
      {c.type === 'recite' && <button type="button" onClick={() => go('recite')} className="press mt-3 flex items-center gap-1.5 text-[12px] text-muted underline"><Icon name="mic" size={13} />التسميع الذكي بالميكروفون · قيد الإعداد</button>}
      <Assess value={assessed} onPick={(r) => (setAssessed(r), onRecord({ status: 'done', recall: r, hintsUsed: hints }))} />
      {assessed && <Primary onClick={onNext}>التالي</Primary>}
    </div>
  )
}

/** End of one ayah → recall the opening of the next. */
function ConnectBody({ c, gs, ayah, hafs, onRecord, onNext }: BodyProps) {
  const end = words(ayah(c.from)).slice(-4).join(' ')
  const next = words(ayah(c.to))
  const [show, setShow] = useState<0 | 1 | 2>(0)
  const [assessed, setAssessed] = useState<RecallOutcome | null>(gs.done[c.id]?.recall ?? null)
  return (
    <div>
      <div className="mf-paper rounded-[22px] px-5 py-5">
        <p className="text-[11.5px] text-[var(--mf-ink-soft)]">نهاية الآية {toAr(c.from)}</p>
        <p className={`mf-text ${hafs ? '' : 'tanzil'}`} style={{ fontSize: 22, lineHeight: 2.1 }}>… {end} <span className="mf-num">{toAr(c.from)}</span></p>
        <hr className="my-3 border-[var(--mf-frame-soft)]" />
        <p className="text-[11.5px] text-[var(--mf-ink-soft)]">بداية الآية {toAr(c.to)}؟</p>
        <p className={`mf-text ${hafs ? '' : 'tanzil'}`} style={{ fontSize: 22, lineHeight: 2.1 }}>
          {show === 0 ? <span className="text-[14px] text-[var(--mf-ink-soft)]">تذكّرها أولًا، ثم تحقّق</span> : show === 1 ? `${next[0]} …` : `${next.slice(0, 5).join(' ')} …`}
        </p>
      </div>
      <div className="mt-3 flex gap-2 text-[12px]">
        {show < 2 && <button type="button" onClick={() => setShow((s) => (s + 1) as 1 | 2)} className="press h-9 rounded-full px-3.5 ring-1 ring-line">{show === 0 ? 'أول كلمة' : 'أظهر البداية'}</button>}
        {show > 0 && <button type="button" onClick={() => setShow(0)} className="press h-9 rounded-full px-3.5 ring-1 ring-line">أخفِ</button>}
      </div>
      <Assess value={assessed} onPick={(r) => (setAssessed(r), onRecord({ status: 'done', recall: r, hintsUsed: show }))} />
      {assessed && <Primary onClick={onNext}>التالي</Primary>}
    </div>
  )
}

function ReflectBody({ c, ayah, hafs, onRecord, onNext }: BodyProps) {
  const ses = useSession()
  const [a, setA] = useState(c.from)
  const [t, setT] = useState(ses.s.notes[akey(c.s, a)] ?? '')
  useEffect(() => setT(ses.s.notes[akey(c.s, a)] ?? ''), [a]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      {c.to > c.from && (
        <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
          {Array.from({ length: c.to - c.from + 1 }, (_, i) => c.from + i).map((x) => <button key={x} type="button" onClick={() => setA(x)} aria-pressed={a === x} className={`press h-8 shrink-0 rounded-full px-3 text-[12px] ${a === x ? 'bg-night text-parchment' : 'ring-1 ring-line'}`}>الآية {toAr(x)}</button>)}
        </div>
      )}
      <AyahText s={c.s} a={a} t={ayah(a)} hafs={hafs} size={20} />
      <label className="mt-4 block text-[12px] text-muted">تأمّلك الشخصي (منفصل عن التفسير المنشور)
        <textarea value={t} onChange={(e) => setT(e.target.value)} rows={4} className="mt-1 w-full rounded-[18px] bg-card p-3 text-[14px] leading-relaxed ring-1 ring-line outline-none focus:ring-2 focus:ring-gold" placeholder="ما الذي استوقفك في هذه الآية؟" />
      </label>
      <p className="mt-1 text-[11px] text-muted">لا يُقاس الفهم بعدد التأمّلات. يُحفظ على هذا الجهاز فقط.</p>
      <Primary disabled={!t.trim()} onClick={() => (ses.setNoteAt(c.s, a, t.trim()), onRecord({ status: 'done' }), onNext())}>احفظ التأمّل</Primary>
    </div>
  )
}

function Completion({ gs, seq }: { gs: GuidedSession; seq: GuidedCard[] }) {
  const { go } = useProto()
  const ses = useSession()
  const sum = summarize(seq, gs.done)
  const p = gs.passage
  const chunks = scopeChunks(gs.scope)
  const hasNext = gs.segmentIndex < chunks.length - 1
  const confirmed = (a: number) => ses.s.mem[akey(p.s, a)] === 'mastered'
  const assessed = [...sum.independent, ...sum.hints, ...sum.needs].sort((x, y) => x - y)
  const line = (label: string, list: number[], tone: string) => (
    <li className="flex items-start gap-2 text-[13px]">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone}`} />
      <span className="flex-1"><b className="font-semibold">{label}:</b> {list.length ? list.map((a) => toAr(a)).join('، ') : 'لا شيء'}</span>
    </li>
  )
  return (
    <div data-completion>
      <div className="flex items-center gap-3 rounded-[22px] bg-card p-4 ring-1 ring-line">
        <Illustration id="retention" size={52} />
        <p className="flex-1 text-[13px] leading-relaxed">أنجزت {toAr(sum.practiced)} خطوة{sum.skipped ? `، وأجّلت ${toAr(sum.skipped)} (لم تُحتسب)` : ''}. هذا ما سجّلته بنفسك:</p>
      </div>
      <ul className="mt-3 space-y-1.5">
        {line('تذكّرتها وحدك', sum.independent, 'bg-leaf')}
        {line('احتجت تلميحًا', sum.hints, 'bg-gold')}
        {line('تحتاج تدريبًا أكثر', sum.needs, 'bg-clay')}
      </ul>
      <div className="mt-4 rounded-[20px] bg-card p-4 ring-1 ring-line">
        <p className="text-[13px] font-semibold">تأكيد الحفظ المبدئي</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">لا شيء يُسجَّل تلقائيًا. أكّد فقط ما تثق أنك تحفظه الآن؛ الحفظ المبدئي يختلف عن التثبيت طويل المدى.</p>
        {assessed.length === 0 ? <p className="mt-2 text-[12px] text-muted">لم تُقيّم أي آية في هذه الجلسة.</p> : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {assessed.map((a) => (
              <button key={a} type="button" disabled={confirmed(a)} onClick={() => (ses.setMemAt(p.s, a, 'mastered'), progress.confirmMemorized(p.s, a))} className={`press h-9 rounded-full px-3 text-[12px] font-semibold ${confirmed(a) ? 'bg-leaf/12 text-leaf' : 'bg-night text-parchment'}`} data-confirm-ayah={a}>
                {confirmed(a) ? <span className="inline-flex items-center gap-1"><Icon name="check" size={13} />الآية {toAr(a)} مسجّلة</span> : `أؤكّد حفظ الآية ${toAr(a)}`}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-3 rounded-[16px] bg-night/[.04] px-3 py-2 text-[12px] text-muted">موعد المراجعة القادمة: يحدّده محرك المراجعة الذكية عند تفعيله. لم يُجدول أي موعد بعد.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {hasNext ? (
          <button type="button" onClick={() => guided.setSegment(gs.segmentIndex + 1, true)} className="press h-12 rounded-full bg-night text-[13.5px] font-semibold text-parchment" data-next-segment>احفظ المقطع التالي · {toAr(gs.segmentIndex + 2)}/{toAr(chunks.length)}</button>
        ) : (
          <button type="button" onClick={() => (guided.finish(), go('home'))} className="press h-12 rounded-full bg-night text-[13.5px] font-semibold text-parchment" data-finish>أنهِ النطاق</button>
        )}
        <button type="button" onClick={() => (guided.finish(), go('revision'))} className="press h-12 rounded-full text-[13.5px] ring-1 ring-line">إلى تثبيت المحفوظ</button>
      </div>
    </div>
  )
}
