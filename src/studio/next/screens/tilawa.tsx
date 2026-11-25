// Tilawa recitation UI (design-ready). The @tilawa/core SDK is NOT installed and no
// model is downloaded: the live status is therefore always "engine unavailable",
// and every other state is documented, never simulated. No recognition, mistake,
// progress or score is ever produced here. Manual recitation stays available.
import { useState } from 'react'
import { Icon, toAr, useDevice, useProto } from '../core'
import { surah } from '../../../lib/quran'
import { AI_DISCLAIMER, MISTAKE_AR, MODEL_STATE_AR, type TilawaState } from '../learning/contracts'
import { guided } from '../learning/store'
import { MistakeHistory } from './retention'
import { Illustration } from '../illustrations'

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
