// Tilawa recitation UI (design-ready). The @tilawa/core SDK is NOT installed and no
// model is downloaded: the live status is therefore always "engine unavailable",
// and every other state is documented, never simulated. No recognition, mistake,
// progress or score is ever produced here. Manual recitation stays available.
import { useState } from 'react'
import { Chrome, Head, Icon, toAr, useDevice, useProto } from '../core'
import { gIndex, surah } from '../../../lib/quran'
import { AI_DISCLAIMER, MISTAKE_AR, MODEL_STATE_AR, type TilawaState } from '../learning/contracts'
import { guided, useGuided } from '../learning/store'
import { MistakeHistory } from './retention'
import { Illustration } from '../illustrations'
import { readTasmeeScope, type TasmeeRange } from '../TasmeeLink'
import { scopeSummary, type ScopeSeed } from '../learning/scope'
import { MemorizationSelector } from '../learning/selector'

type P = { s: number; from: number; to: number }

const FLOW: { id: TilawaState; ar: string; sub: string }[] = [
  { id: 'select-passage', ar: 'اختيار المقطع', sub: 'أو «سمّع من أي موضع»' },
  { id: 'preparing-model', ar: 'تجهيز المحرك', sub: 'يُحمّل عند الطلب فقط' },
  { id: 'mic-permission', ar: 'إذن الميكروفون', sub: 'يُطلب قبل الاستماع' },
  { id: 'ready', ar: 'جاهز للاستماع', sub: '' },
  { id: 'listening', ar: 'يستمع', sub: 'النص مخفي أو جزئي' },
  { id: 'identifying', ar: 'تحديد الموضع', sub: 'في الوضع الحر' },
  { id: 'tracking', ar: 'تتبّع الكلمة الحالية', sub: 'تُكشف الكلمات تباعًا' },
  { id: 'uncertain', ar: 'تعرّف غير مؤكّد', sub: 'لا حكم' },
  { id: 'lost', ar: 'فقدان التتبّع', sub: 'اقتراح استئناف' },
  { id: 'suspected-mistake', ar: 'خطأ محتمل', sub: 'ملاحظة مبدئية' },
  { id: 'confirmed-mistake', ar: 'خطأ أكّده المحرك', sub: 'ليس تصحيح معلّم' },
  { id: 'self-corrected', ar: 'صحّحت بنفسك', sub: '' },
  { id: 'completed', ar: 'انتهت الجلسة', sub: 'تقرير هادئ' },
  { id: 'unsupported-device', ar: 'الجهاز غير مدعوم', sub: 'التسميع اليدوي متاح' },
  { id: 'engine-unavailable', ar: 'المحرك غير متاح', sub: 'الحالة الحالية' },
]
const TONES = [
  { c: 'bg-gold text-white', ar: 'الكلمة الحالية', sub: 'ذهبي' },
  { c: 'bg-leaf/15 text-leaf', ar: 'تقدّم مُتعرَّف عليه', sub: 'أخضر هادئ' },
  { c: 'bg-[#e9b949]/25 text-[#8a6410]', ar: 'ملاحظة مبدئية', sub: 'كهرماني' },
  { c: 'bg-clay/15 text-clay', ar: 'ملاحظة مؤكّدة آليًا', sub: 'أحمر خافت' },
  { c: 'bg-night/[.06] text-muted', ar: 'غير مؤكّد', sub: 'محايد' },
]

export function TilawaSection({ p }: { p: P }) {
  const desk = useDevice() === 'desktop'
  const { go } = useProto()
  const [mode, setMode] = useState<'passage' | 'free'>('passage')
  const manual = () => guided.start({ s: p.s, from: p.from, to: p.to }, 'quick-review') && go('guided')
  return (
    <div className="space-y-4" data-tilawa>
      <div className="rounded-[26px] bg-card p-5 ring-1 ring-line">
        <div className="flex items-start gap-4">
          <Illustration id="recite" size={desk ? 68 : 56} />
          <div className="min-w-0 flex-1">
            <div role="tablist" aria-label="نوع التسميع" className="inline-flex rounded-full bg-night/[.06] p-1 text-[12.5px]">
              {([['passage', 'التسميع من مقطع محدد'], ['free', 'سمّع من أي موضع']] as const).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`press h-8 rounded-full px-3 ${mode === k ? 'bg-card font-semibold shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-muted'}`}>{l}</button>
              ))}
            </div>
            <p className="mt-2 text-[13px]">{mode === 'passage' ? `المقطع: سورة ${surah(p.s).ar} · ${p.from === p.to ? `الآية ${toAr(p.from)}` : `الآيات ${toAr(p.from)}–${toAr(p.to)}`}` : 'ابدأ التلاوة من أي موضع تحفظه، وسيحاول المحرك تحديد السورة والآية.'}</p>
          </div>
        </div>
        <div role="status" className="mt-4 flex flex-wrap items-center gap-3 rounded-[18px] bg-night/[.04] p-3.5" data-tilawa-status>
          <span className="h-2.5 w-2.5 rounded-full bg-muted" />
          <div className="min-w-0 flex-1 text-[12.5px]">
            <p className="font-semibold">{MODEL_STATE_AR['not-loaded']} · غير متاح في هذه النسخة</p>
            <p className="text-muted">حزمة المحرك (@tilawa/core) غير مثبّتة ولم يُنزَّل أي نموذج. لا يُستخدم الميكروفون هنا.</p>
          </div>
          <button type="button" onClick={() => go('settings')} className="press h-9 rounded-full px-3.5 text-[12px] ring-1 ring-line">إدارة المحرك</button>
        </div>
        <button type="button" onClick={manual} className="press mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-night text-[14px] font-semibold text-parchment" data-manual-recite>
          <Icon name="eyeOff" size={16} />سمّع يدويًا مع إخفاء النص
        </button>
        <p className="mt-3 text-[11.5px] leading-relaxed text-muted" data-disclaimer>{AI_DISCLAIMER} لا يدّعي المحرك تصحيح التجويد أو المخارج.</p>
      </div>

      <div className={`grid gap-4 ${desk ? 'grid-cols-2' : ''}`}>
        <section className="rounded-[22px] bg-card p-4 ring-1 ring-line">
          <p className="text-[13px] font-semibold">مراحل التسميع الذكي <span className="ms-1 rounded-full bg-sky/10 px-2 py-0.5 text-[10.5px] text-sky">تصميم جاهز</span></p>
          <ol className="mt-3 grid grid-cols-2 gap-1.5 text-[11.5px]">
            {FLOW.map((f) => (
              <li key={f.id} aria-current={f.id === 'engine-unavailable' ? 'step' : undefined} className={`rounded-[12px] px-2.5 py-1.5 ${f.id === 'engine-unavailable' ? 'bg-gold-soft font-semibold' : 'bg-night/[.03]'}`}>
                {f.ar}{f.sub && <span className="block text-[10.5px] font-normal text-muted">{f.sub}</span>}
              </li>
            ))}
          </ol>
        </section>
        <section className="space-y-4">
          <div className="rounded-[22px] bg-card p-4 ring-1 ring-line">
            <p className="text-[13px] font-semibold">ألوان التتبّع</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">{TONES.map((t) => <li key={t.ar} className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${t.c}`}>{t.ar} <span className="font-normal opacity-75">· {t.sub}</span></li>)}</ul>
            <p className="mt-2 text-[10.5px] text-muted">تُطبّق على كلمات نص حفص المعتمد كما هو؛ لا يُعرض نص مولَّد أبدًا.</p>
          </div>
          <div className="rounded-[22px] bg-card p-4 ring-1 ring-line">
            <p className="text-[13px] font-semibold">أنواع الملاحظات</p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5 text-[11.5px]">{Object.values(MISTAKE_AR).map((m) => <li key={m} className="rounded-[12px] bg-night/[.03] px-2.5 py-1.5">{m}</li>)}</ul>
            <p className="mt-2 text-[10.5px] text-muted">تظهر فقط الأنواع التي يدعمها المحرك فعلًا بعد التحقّق.</p>
          </div>
        </section>
      </div>

      <section className="rounded-[22px] border border-dashed border-line bg-card/60 p-4" data-report-empty>
        <p className="text-[13px] font-semibold">تقرير الجلسة</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">لا تقرير: لم تُجرَ جلسة تسميع آلي. سيعرض التقرير المدة الفعلية، والمقطع، ومواضع الملاحظات (كلمة مختلفة، ناقصة، زائدة، مقطع متجاوز)، وما صحّحته بنفسك، وما لم يتأكّد منه المحرك — بلا نسب أو درجات.</p>
      </section>
      <MistakeHistory />
    </div>
  )
}


export function TasmeeEntry() {
  const { nav, go } = useProto()
  const state = useGuided()
  const scope = readTasmeeScope(nav.param)
  const [picker, setPicker] = useState<ScopeSeed | null>(null)
  const mode = nav.param === 'weak' || nav.param === 'free' ? nav.param : null
  const [error, setError] = useState('')
  const [replace, setReplace] = useState(false)
  const active = state.session && !state.session.finishedAt ? state.session : null
  const passage = scope && scopeSummary(scope)
  const base = passage?.from ?? { s: 1, a: 1 }
  const targets: { label: string; seed: ScopeSeed }[] = [
    { label: 'تسميع سورة', seed: { kind: 'surah', s: base.s } },
    { label: 'تسميع صفحة', seed: { kind: 'page', page: scope?.fromPage ?? 1 } },
    { label: 'تسميع مجموعة آيات', seed: { kind: 'ayahs', s: base.s, from: base.a, to: passage?.to.s === base.s ? passage.to.a : base.a } },
  ]
  const choose = ({ g0, g1 }: TasmeeRange) => {
    setReplace(false)
    go('recite', g0 + '-' + g1)
  }
  const manual = () => {
    if (!scope || mode || (active && (!replace || state.saved.length >= 8))) return
    if (!guided.startScope(scope, 'quick-review', null)) {
      setError('تعذّر بدء التسميع. تحقّق من النطاق المحدّد.')
      return
    }
    go('guided')
  }
  const weak = [...new Map(state.weak.filter((r) => !r.reviewed).map((r) => [r.s + ':' + r.a, r])).values()]
  const option = 'press min-h-11 rounded-full bg-card px-4 text-[13px] font-semibold ring-1 ring-line'
  return (
    <Chrome>
      <div className="mx-auto max-w-[900px] space-y-4 px-5 py-6" data-tasmee>
        <Head title="سمّع" sub="اختر ما تريد تسميعه من حفظك ثم أظهر النص للتحقّق." action={<Illustration id="recite" size={64} />} />
        <div className="flex flex-wrap gap-2" aria-label="نطاق التسميع">
          {targets.map(({ label, seed }) => <button key={label} type="button" className={option} onClick={() => setPicker(seed)}>{label}</button>)}
          <button type="button" className={option} aria-pressed={mode === 'weak'} onClick={() => go('recite', 'weak')}>تسميع مواضع الضعف</button>
          <button type="button" className={option} aria-pressed={mode === 'free'} onClick={() => go('recite', 'free')}>سمّع من أي موضع</button>
        </div>
        {mode === 'weak' && <section className="rounded-[22px] bg-card p-4 ring-1 ring-line">
          <p className="text-sm font-semibold">مواضع الضعف المسجّلة</p>
          {weak.length === 0 ? <p className="mt-1 text-sm text-muted">لا توجد مواضع تحتاج إلى مراجعة في سجلك حاليًا.</p> :
            <div className="mt-2 flex flex-wrap gap-2">{weak.map((r) => {
              const g = gIndex(r.s, r.a)
              return <button key={g} type="button" className={option} onClick={() => choose({ g0: g, g1: g })}>{surah(r.s).ar} · {toAr(r.a)}</button>
            })}</div>}
        </section>}
        {passage && !mode && <section className="space-y-3 rounded-[22px] bg-card p-5 ring-1 ring-line" data-tasmee-scope data-g0={passage.g0} data-g1={passage.g1}>
          <h2 className="text-base font-bold">التسميع اليدوي</h2>
          <p className="text-sm">{passage.range} · {toAr(passage.ayat)} آية · ص {toAr(passage.fromPage)}–{toAr(passage.toPage)}</p>
          <p className="text-sm text-muted">سمّع بصوتك ثم اكشف الآيات للتحقّق بنفسك. النص مخفي في البداية والميكروفون مغلق.</p>
          {active && <div className="space-y-2 rounded-[16px] bg-gold-soft p-3 text-sm">
            <p>لديك جلسة غير مكتملة: {active.scope.label}</p>
            {state.saved.length >= 8
              ? <p>أكمل إحدى جلساتك قبل بدء تمرين جديد من هنا.</p>
              : <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />احفظ الجلسة الحالية في الأرشيف وابدأ التسميع</label>}
            <button type="button" className={option} onClick={() => go(active.experience === 'guided' ? 'guided' : 'ayah')}>استأنف الجلسة الحالية</button>
          </div>}
          <button type="button" onClick={manual} disabled={!!active && (!replace || state.saved.length >= 8)} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-night px-4 font-semibold text-parchment disabled:opacity-40" data-manual-recite>
            <Icon name="eyeOff" size={17} />سمّع يدويًا مع إخفاء النص
          </button>
          {error && <p role="alert" className="text-sm text-clay">{error}</p>}
        </section>}
        <section className="rounded-[22px] bg-night/[.04] p-4 text-sm ring-1 ring-line" data-tilawa-status>
          <h2 className="font-semibold">التسميع الذكي غير متاح حاليًا</h2>
          <p className="mt-1 text-muted">{mode === 'free' ? 'يتطلّب التعرّف التلقائي على موضع التلاوة محرك التسميع. اختر سورة أو صفحة أو آيات للتسميع اليدوي.' : 'التعرّف على التلاوة وتصحيحها يحتاجان إلى محرك التسميع. يمكنك استخدام التسميع اليدوي الآن.'}</p>
        </section>
      </div>
      {picker && <MemorizationSelector seed={picker} onClose={() => setPicker(null)} onSelect={choose} />}
    </Chrome>
  )
}
