import { TilawaModels } from '../tilawa/ModelManager'
import { legacyUrl } from '../../../lib/applicationMode'
import { PALETTES } from '../../../lib/palettes'
import { setProductionAppearance, useProductionAppearance } from '../productionAppearance'
import { migration } from '../productionStorage'
// الإعدادات — learning preferences, offline AI model manager (design-ready), privacy and
// local data (design preview). Device readings are real browser feature checks and the
// browser's own storage estimate; nothing is downloaded and no progress is simulated.
import { useEffect, useState, type ReactNode } from 'react'
import { Chrome, Head, Icon, MoreTabs, toAr, useDevice, useProto } from '../core'
import { SURAHS, surah } from '../../../lib/quran'
import { MODEL_STATE_AR, MODEL_VARIANTS, PREFERENCE_AR, type LearningPreference, type ModelVariant } from '../learning/contracts'
import { guided, useGuided } from '../learning/store'
import { STORE_AR } from '../storageSafety'
import { Illustration } from '../illustrations'

function useDeviceCheck() {
  const [est, setEst] = useState<{ quota: number; usage: number } | null | false>(null)
  useEffect(() => {
    const s = typeof navigator !== 'undefined' ? navigator.storage : undefined
    if (!s?.estimate) return setEst(false)
    s.estimate().then((e) => setEst({ quota: e.quota ?? 0, usage: e.usage ?? 0 }), () => setEst(false))
  }, [])
  const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : {}
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : undefined
  return {
    est,
    wasm: typeof WebAssembly === 'object',
    worklet: 'AudioWorkletNode' in w,
    mic: !!nav?.mediaDevices?.getUserMedia,
    memory: nav?.deviceMemory ?? null,
  }
}

export function SettingsScreen() {
  const desk = useDevice() === 'desktop'
  const { go, production } = useProto()
  const g = useGuided()
  return (
    <Chrome>
      <div className={desk ? 'no-scrollbar mx-auto h-full max-w-[900px] overflow-y-auto px-10 py-9' : 'px-5 pb-8 pt-4'} data-settings>
        {!desk && <MoreTabs />}
        <Head title="الإعدادات" sub="تفضيلات التعلّم، والمظهر، والخصوصية والبيانات المحلية." />
        <div className="space-y-5">
          <Section title="التعلّم" icon="sprout">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="تفضيل التعلّم">
              {(Object.keys(PREFERENCE_AR) as LearningPreference[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={g.profile.preference === k} onClick={() => guided.setProfile({ preference: k })} className={`press rounded-[16px] p-3 text-start ${g.profile.preference === k ? 'bg-gold-soft ring-2 ring-gold/60' : 'bg-night/[.03] ring-1 ring-line'}`}>
                  <span className="block text-[13px] font-semibold">{PREFERENCE_AR[k].ar}</span>
                  <span className="block text-[11px] text-muted">{PREFERENCE_AR[k].sub}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[12.5px]">الوقت اليومي: <b>{g.profile.minutes ? `${toAr(g.profile.minutes)} دقيقة` : 'غير محدّد'}</b> · <button type="button" onClick={() => go('guided')} className="text-gold underline">غيّره من الرحلة الموجّهة</button></p>
            <button type="button" onClick={() => go('welcome')} className="press mt-3 h-10 rounded-full px-4 text-[12.5px] ring-1 ring-line" data-rerun-onboarding>{g.profile.onboarded ? 'أعد الإعداد التعريفي' : 'ابدأ الإعداد التعريفي'}</button>
          </Section>
          <SelfReported />
          {production ? <TilawaModels /> : <ModelManager />}
          <Section title="الخصوصية والبيانات المحلية" icon="lock">
            <ul className="space-y-1.5 text-[12.5px] leading-relaxed">
              <li>بياناتك محفوظة على هذا المتصفح في هذا الجهاز فقط، بلا حساب ولا مزامنة ولا إرسال.</li>
              <li>تُعالج التلاوة على هذا الجهاز. لا يُرفع الصوت ولا يُحفظ التسجيل.</li>
              <li>التطبيق مجاني بالكامل: بلا إعلانات ولا اشتراكات ولا خدمات ذكاء اصطناعي مدفوعة.</li>
            </ul>
            <p className="mb-1 mt-3 text-[12px] font-semibold text-muted">مفاتيح التخزين المحلي</p>
            <ul className="space-y-1 text-[11.5px]">
              {Object.entries(STORE_AR).map(([k, v]) => <li key={k} className="flex flex-wrap justify-between gap-2 rounded-[10px] bg-night/[.03] px-2.5 py-1.5"><span>{v}</span><code className="text-muted" dir="ltr">{k}</code></li>)}
            </ul>
            <p className="mt-2 text-[11px] text-muted">لا يُمسح أي شيء تلقائيًا. البيانات غير المقروءة تُنسخ جانبًا قبل أي كتابة.</p>
          </Section>
          {production && <Section title="البيانات السابقة" icon="library">
            <div className="space-y-2 text-sm">
              {migration === null && <p role="status">تعذّر إكمال نقل البيانات المحلية. يمكنك الوصول إلى البيانات السابقة من روابط الاسترجاع.</p>}
              {migration?.legacy && <p>ملفات المستخدمين وسجلات النسخة السابقة متاحة في التطبيق السابق على هذا الجهاز.</p>}
              {!!migration?.retainedInPreview.length && <p>بعض بيانات المعاينة بقيت في مكانها بسبب وجود بيانات تجريبية أو تعارض في التخزين.</p>}
              <div className="flex flex-wrap gap-3">
                <a href={legacyUrl} className="inline-flex min-h-11 items-center underline">افتح التطبيق السابق</a>
                {(migration === null || !!migration.retainedInPreview.length) && <a href="#/design-studio/next" className="inline-flex min-h-11 items-center underline">استرجع بيانات المعاينة</a>}
              </div>
            </div>
          </Section>}
          <Section title="المظهر وإمكانية الوصول" icon="palette">
            {production && <AppearancePicker />}
            <p className="text-[12.5px] leading-relaxed text-muted">الحركة تحترم «تقليل الحركة» في النظام، والتنقّل بين البطاقات ممكن بالأزرار ولوحة المفاتيح، لا بالسحب وحده.</p>
          </Section>
        </div>
      </div>
    </Chrome>
  )
}

function Section({ title, icon, children, badge }: { title: string; icon: string; children: ReactNode; badge?: ReactNode }) {
  return (
    <section className="rounded-[24px] bg-card p-5 ring-1 ring-line">
      <p className="mb-3 flex items-center gap-2 text-[15px] font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-soft text-gold"><Icon name={icon} size={16} /></span><span className="flex-1">{title}</span>{badge}</p>
      {children}
    </section>
  )
}

/** Previously memorised passages, recorded as self-reported (never verified mastery). */
export function SelfReported() {
  const g = useGuided()
  const [s, setS] = useState(1)
  const [from, setFrom] = useState('1')
  const [to, setTo] = useState('7')
  const [err, setErr] = useState<string | null>(null)
  const field = 'h-10 rounded-xl bg-night/[.03] px-2 text-[13px] ring-1 ring-line'
  return (
    <Section title="ما تحفظه سابقًا" icon="bookmark" badge={<span className="rounded-full bg-night/[.05] px-2 py-0.5 text-[10.5px] text-muted">تقرير ذاتي</span>}>
      <p className="mb-3 text-[12px] text-muted">يُسجَّل كحفظ سابق بتقريرك أنت، لا كإتقان مُتحقَّق منه، ولا يمنح إنجازات. يفيد في اقتراح جلسات «تثبيت المحفوظ».</p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); const ok = guided.addSelfReported({ s, from: Number(from), to: Number(to) }); setErr(ok ? null : 'تحقّق من مدى الآيات في هذه السورة.') }}>
        <select aria-label="السورة" value={s} onChange={(e) => { const x = Number(e.target.value); setS(x); setFrom('1'); setTo(String(surah(x).ayat)) }} className={`${field} min-w-0 flex-1`}>{SURAHS.map((x) => <option key={x.n} value={x.n}>{toAr(x.n)}. {x.ar}</option>)}</select>
        <input aria-label="من الآية" type="number" min={1} value={from} onChange={(e) => setFrom(e.target.value)} className={`${field} w-16 text-center`} />
        <input aria-label="إلى الآية" type="number" min={1} value={to} onChange={(e) => setTo(e.target.value)} className={`${field} w-16 text-center`} />
        <button type="submit" className="press h-10 rounded-full bg-night px-4 text-[12.5px] font-semibold text-parchment">أضف</button>
      </form>
      {err && <p role="alert" className="mt-2 text-[12px] text-clay">{err}</p>}
      {g.profile.selfReported.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {g.profile.selfReported.map((r, i) => <li key={i} className="flex items-center gap-1 rounded-full bg-night/[.05] py-1 pe-1 ps-3 text-[12px]">{surah(r.s).ar} {toAr(r.from)}–{toAr(r.to)}<button type="button" aria-label="إزالة" onClick={() => guided.removeSelfReported(i)} className="press flex h-6 w-6 items-center justify-center rounded-full hover:bg-night/10"><Icon name="x" size={12} /></button></li>)}
        </ul>
      )}
    </Section>
  )
}

function ModelManager() {
  const d = useDeviceCheck()
  const [pick, setPick] = useState<ModelVariant>('light')
  const mb = (n: number) => `${toAr(Math.round(n / 1048576))} م.ب`
  const free = d.est ? d.est.quota - d.est.usage : null
  return (
    <Section title="محرك التسميع دون إنترنت" icon="mic" >
      <div className="flex items-center gap-3 rounded-[16px] bg-night/[.04] p-3" role="status" data-model-state>
        <Illustration id="model" size={44} />
        <div className="flex-1 text-[12.5px]"><p className="font-semibold">{MODEL_STATE_AR['not-loaded']}</p><p className="text-muted">حزمة المحرك غير مثبّتة في هذه النسخة؛ سيُفعَّل التحميل في مرحلة الهندسة.</p></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="نوع النموذج">
        {(Object.keys(MODEL_VARIANTS) as ModelVariant[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={pick === k} onClick={() => setPick(k)} className={`press rounded-[16px] p-3 text-start ${pick === k ? 'bg-gold-soft ring-2 ring-gold/60' : 'bg-night/[.03] ring-1 ring-line'}`}>
            <span className="block text-[13px] font-semibold">{MODEL_VARIANTS[k].ar}</span>
            <span className="block text-[11.5px] text-muted">تنزيل نحو {toAr(MODEL_VARIANTS[k].approxMB)} م.ب (مُعلن، يُتحقّق منه) · {MODEL_VARIANTS[k].sub}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-muted">حجم التنزيل لا يساوي استهلاك الذاكرة أثناء التشغيل؛ سيُقاس الأخير فعليًا قبل الإطلاق.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled title="غير متاح في هذه النسخة" className="h-10 rounded-full bg-night px-4 text-[12.5px] font-semibold text-parchment opacity-40" data-download>نزّل {MODEL_VARIANTS[pick].ar}</button>
        <button type="button" disabled className="h-10 rounded-full px-4 text-[12.5px] ring-1 ring-line opacity-40">احذف النموذج</button>
        <button type="button" disabled className="h-10 rounded-full px-4 text-[12.5px] ring-1 ring-line opacity-40">حرّر ذاكرة المحرك</button>
      </div>
      <p className="mb-1.5 mt-4 text-[12px] font-semibold text-muted">توافق هذا الجهاز (فحص فعلي للمتصفح)</p>
      <ul className="grid grid-cols-2 gap-1.5 text-[11.5px]">
        <Check ok={d.wasm} label="WebAssembly" />
        <Check ok={d.worklet} label="معالجة الصوت (AudioWorklet)" />
        <Check ok={d.mic} label="الوصول إلى الميكروفون" />
        <li className="rounded-[10px] bg-night/[.03] px-2.5 py-1.5">مساحة متاحة للمتصفح: {d.est === null ? '…' : d.est === false ? 'غير معروفة' : mb(free!)}</li>
        {d.memory != null && <li className="rounded-[10px] bg-night/[.03] px-2.5 py-1.5">ذاكرة الجهاز (تقدير المتصفح): {toAr(d.memory)} غ.ب</li>}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">عند التفعيل: لا يُحمّل المحرك عند بدء التطبيق، ويُحمّل النموذج المختار عند طلبه فقط، ولا يُجهَّز نموذجان معًا، ويُحرَّر الميكروفون والذاكرة بعد الاستخدام. القراءة والحفظ اليدوي والمراجعة والأذكار تعمل دون أي نموذج. الحالات المعتمدة: {Object.values(MODEL_STATE_AR).join(' · ')}.</p>
    </Section>
  )
}
const Check = ({ ok, label }: { ok: boolean; label: string }) => (
  <li className="flex items-center gap-1.5 rounded-[10px] bg-night/[.03] px-2.5 py-1.5"><Icon name={ok ? 'check' : 'x'} size={12} className={ok ? 'text-leaf' : 'text-clay'} />{label}</li>
)


function AppearancePicker() {
  const { appearance } = useProductionAppearance()
  return (
    <div className="mb-3 flex flex-wrap gap-3 text-sm">
      <label className="grid gap-1">الوضع
        <select aria-label="الوضع" value={appearance.theme} className="h-11 rounded-xl bg-card px-3 ring-1 ring-line"
          onChange={(e) => setProductionAppearance({ theme: e.target.value as typeof appearance.theme })}>
          <option value="system">حسب الجهاز</option><option value="light">فاتح</option><option value="dark">داكن</option>
        </select>
      </label>
      <label className="grid gap-1">الألوان
        <select aria-label="الألوان" value={appearance.palette} className="h-11 rounded-xl bg-card px-3 ring-1 ring-line"
          onChange={(e) => setProductionAppearance({ palette: e.target.value as typeof appearance.palette })}>
          {PALETTES.map((palette) => <option key={palette.id} value={palette.id}>{palette.ar}</option>)}
        </select>
      </label>
    </div>
  )
}
