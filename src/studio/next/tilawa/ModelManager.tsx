import { useEffect, useState } from 'react'
import { Icon, toAr } from '../core'
import { Illustration } from '../illustrations'
import type { ModelVariant } from '../learning/contracts'
import { cachedModels, cancelTilawa, deleteTilawa, loadTilawa, tilawa, useTilawa } from './engine'
import { MODELS, supportedDevice } from './models'

export const toolButton = 'press min-h-11 rounded-full bg-card px-4 text-[13px] font-semibold ring-1 ring-line disabled:opacity-40'
export const variantName = { light: 'الخفيف · موصى به للأجهزة الأقدم', full: 'الكامل' }
export const mb = (n: number) => toAr((n / 1e6).toFixed(2)) + ' م.ب'

export function TilawaModels() {
  const v = useTilawa()
  const [pick, setPick] = useState<ModelVariant>(v.variant)
  const [saved, setSaved] = useState<ModelVariant[]>([])
  const [error, setError] = useState(false)
  const busy = v.model === 'downloading' || v.model === 'initializing'
  const refresh = () => cachedModels().then(setSaved, () => setError(true))
  useEffect(() => { void refresh() }, [v.model])
  const ok = supportedDevice()
  const status = !ok ? 'الجهاز أو المتصفح لا يدعم محرك التسميع' :
    v.model === 'downloading' ? 'جارٍ تنزيل النموذج' : v.model === 'initializing' ? 'جارٍ تهيئة المحرك' :
    v.model === 'ready' ? 'المحرك جاهز على هذا الجهاز' : v.model === 'failed' ? 'تعذّر تجهيز المحرك' : 'المحرك غير محمّل'
  return (
    <section className="space-y-3 rounded-[24px] bg-card p-4 ring-1 ring-line" data-smart-models>
      <div className="flex items-center gap-3" role="status">
        <Illustration id="model" size={44} />
        <div><h2 className="font-semibold">نماذج التسميع على الجهاز</h2><p className="text-sm text-muted">{status}</p></div>
      </div>
      <fieldset className="flex flex-wrap gap-2" disabled={busy || v.mic !== 'idle'}>
        <legend className="sr-only">اختر النموذج</legend>
        {(Object.keys(MODELS) as ModelVariant[]).map((k) => <label key={k} className="flex min-h-11 items-center gap-2 rounded-xl px-3 ring-1 ring-line text-sm">
          <input type="radio" name="tilawa-model" checked={pick === k} onChange={() => setPick(k)} />
          {variantName[k]} · {mb(MODELS[k].bytes)} {saved.includes(k) && '· محفوظ محليًا'}
        </label>)}
      </fieldset>
      {v.model === 'downloading' && <progress aria-label="تنزيل النموذج" max={1} value={v.progress} className="w-full" />}
      {v.error && <p role="alert" className="text-sm text-clay">{v.error}</p>}
      {error && <p role="status" className="text-sm">التخزين المحلي للنماذج غير متاح.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={toolButton} disabled={!ok || busy || v.mic !== 'idle' || (v.model === 'ready' && v.variant === pick)} onClick={() => loadTilawa(pick)}>{v.model === 'failed' ? 'أعد المحاولة' : saved.includes(pick) ? 'جهّز النموذج المحفوظ' : 'نزّل النموذج وجهّزه'}</button>
        {busy && <button type="button" className={toolButton} onClick={cancelTilawa}>إلغاء</button>}
        <button type="button" className={toolButton} disabled={busy || v.mic !== 'idle' || !saved.includes(pick)} onClick={() => void deleteTilawa(pick).then(refresh, () => setError(true))}>احذف النموذج</button>
        <button type="button" className={toolButton} disabled={v.model !== 'ready' || v.mic !== 'idle'} onClick={() => void tilawa.release()}>حرّر ذاكرة المحرك</button>
      </div>
      <p className="text-xs leading-relaxed text-muted"><Icon name="info" size={13} className="inline" /> الأحجام تخص ملف النموذج. ملفات التشغيل والمرجع نحو ٣٣ م.ب إضافية قبل ضغط النقل، والذاكرة أثناء العمل تختلف حسب الجهاز. يُحفظ النموذج عند توفر التخزين. قد يحتاج فتح التطبيق أو تهيئته من جديد إلى اتصال.</p>
      <p className="text-xs text-muted">نماذج Tilawa، رخصة CC BY 4.0. <a className="underline" href={import.meta.env.BASE_URL + 'third-party/tilawa/SDK-NOTICE.md'}>المصادر والتراخيص</a></p>
    </section>
  )
}
