// الترحيب والإعداد التعريفي — short, skippable onboarding (design preview).
// Answers are stored only in the guided preview store. No ability labels, no tests of
// intelligence; the optional practical check is a normal guided session on a short
// passage whose outcomes are the learner's own self-assessments.
import { useState, type ReactNode } from 'react'
import { Chrome, Icon, toAr, useDevice, useProto } from '../core'
import { PREFERENCE_AR, type LearningPreference } from '../learning/contracts'
import { guided, useGuided, type Profile } from '../learning/store'
import { SelfReported } from './settings'
import { Illustration } from '../illustrations'

type Step = 'hello' | 'experience' | 'reading' | 'goal' | 'time' | 'style' | 'known' | 'check'
const STEPS: Step[] = ['hello', 'experience', 'reading', 'goal', 'time', 'style', 'known', 'check']

export function Welcome() {
  const desk = useDevice() === 'desktop'
  const { go } = useProto()
  const g = useGuided()
  const [i, setI] = useState(0)
  const step = STEPS[i]
  const next = () => (i < STEPS.length - 1 ? setI(i + 1) : finish())
  const finish = (to: 'home' | 'guided' = 'home') => (guided.setProfile({ onboarded: true }), go(to))
  const set = (p: Partial<Profile>) => (guided.setProfile(p), next())
  const opt = (on: boolean, label: string, sub: string | null, onClick: () => void) => (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={`press w-full rounded-[18px] p-4 text-start ${on ? 'bg-gold-soft ring-2 ring-gold/60' : 'bg-card ring-1 ring-line'}`}>
      <span className="block text-[14px] font-semibold">{label}</span>
      {sub && <span className="mt-0.5 block text-[12px] text-muted">{sub}</span>}
    </button>
  )
  const body: Record<Step, ReactNode> = {
    hello: (
      <div className="text-center">
        <div className="flex justify-center"><Illustration id="welcome" size={96} /></div>
        <h1 className="mt-4 font-arabic-display text-[28px] font-bold">رفيقك في القرآن</h1>
        <p className="mt-1 text-[15px] font-semibold text-gold">احفظ بفهم، وثبّت بذكاء</p>
        <p className="mx-auto mt-3 max-w-[360px] text-[13.5px] leading-relaxed text-muted">مجاني بالكامل. أسئلة قليلة تساعدنا على اقتراح جلسة مناسبة، ويمكنك تخطّيها والبدء فورًا. لا يغني عن معلّم قرآن مؤهّل.</p>
      </div>
    ),
    experience: (
      <Q t="هل حفظت شيئًا من القرآن من قبل؟">
        {opt(g.profile.experience === 'none', 'أبدأ الآن', null, () => set({ experience: 'none' }))}
        {opt(g.profile.experience === 'some', 'حفظت سورًا قصيرة أو بعض الأجزاء', null, () => set({ experience: 'some' }))}
        {opt(g.profile.experience === 'much', 'أحفظ أجزاء كثيرة وأريد تثبيتها', null, () => set({ experience: 'much' }))}
      </Q>
    ),
    reading: (
      <Q t="كيف تصف قراءتك للمصحف؟">
        {opt(g.profile.reading === 'learning', 'ما زلت أتعلّم القراءة', 'سنعتمد على الاستماع أكثر', () => set({ reading: 'learning' }))}
        {opt(g.profile.reading === 'fluent', 'أقرأ بطلاقة', null, () => set({ reading: 'fluent' }))}
      </Q>
    ),
    goal: (
      <Q t="ما هدفك الأهم الآن؟">
        {opt(g.profile.goal === 'hifz', 'حفظ جديد', null, () => set({ goal: 'hifz' }))}
        {opt(g.profile.goal === 'retention', 'تثبيت ما أحفظه', null, () => set({ goal: 'retention', preference: 'retention' }))}
        {opt(g.profile.goal === 'understanding', 'الفهم والتدبّر مع الحفظ', null, () => set({ goal: 'understanding', preference: 'tadabbur' }))}
      </Q>
    ),
    time: (
      <Q t="كم دقيقة تتاح لك عادةً في اليوم؟">
        <div className="grid grid-cols-4 gap-2">
          {[1, 5, 10, 15, 30, 45, 60].map((m) => <button key={m} type="button" role="radio" aria-checked={g.profile.minutes === m} onClick={() => set({ minutes: m })} className={`press h-12 rounded-[14px] text-[13px] ${g.profile.minutes === m ? 'bg-night font-semibold text-parchment' : 'bg-card ring-1 ring-line'}`}>{m === 1 ? 'دقيقة' : `${toAr(m)} د`}</button>)}
        </div>
        <p className="text-[12px] text-muted">يمكنك تغييرها كل يوم. لا نعد بكمية حفظ محددة في وقت محدد.</p>
      </Q>
    ),
    style: (
      <Q t="كيف تحب أن تتعلّم؟">
        {opt(g.profile.style === 'guided', 'وجّهني خطوة بخطوة', 'الرحلة الموجّهة · موصى بها', () => set({ style: 'guided' }))}
        {opt(g.profile.style === 'free', 'أفضّل أن أختار بنفسي', 'الحفظ الحر', () => set({ style: 'free' }))}
        <p className="pt-2 text-[12.5px] font-semibold">الطريقة</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PREFERENCE_AR) as LearningPreference[]).map((k) => <button key={k} type="button" aria-pressed={g.profile.preference === k} onClick={() => guided.setProfile({ preference: k })} className={`press rounded-[14px] p-2.5 text-start text-[12px] ${g.profile.preference === k ? 'bg-gold-soft ring-2 ring-gold/60' : 'bg-card ring-1 ring-line'}`}><b className="block">{PREFERENCE_AR[k].ar}</b><span className="text-muted">{PREFERENCE_AR[k].sub}</span></button>)}
        </div>
      </Q>
    ),
    known: (
      <Q t="ما الذي تحفظه سابقًا؟ (اختياري)">
        <SelfReported />
      </Q>
    ),
    check: (
      <Q t="تجربة عملية قصيرة (اختيارية)">
        <p className="text-[13px] leading-relaxed text-muted">جلسة موجّهة قصيرة على سورة الإخلاص. أنت من يقيّم استرجاعك؛ لا تصنيف لقدراتك ولا درجات، والنتيجة لا تُسجَّل حفظًا إلا بتأكيدك.</p>
        <button type="button" onClick={() => (guided.setProfile({ onboarded: true }), guided.start({ s: 112, from: 1, to: 4 }, 'five', 5), go('guided'))} className="press h-12 w-full rounded-full bg-night text-[14px] font-semibold text-parchment" data-try-check>جرّب الآن</button>
      </Q>
    ),
  }
  return (
    <Chrome dock={false}>
      <div className={`flex min-h-full flex-col ${desk ? 'mx-auto max-w-[560px] px-8 py-10' : 'px-5 pb-8 pt-4'}`} data-welcome>
        <div className="mb-6 flex items-center gap-3">
          <span className="flex flex-1 gap-1" aria-label={`الخطوة ${i + 1} من ${STEPS.length}`}>{STEPS.map((s, j) => <span key={s} className={`h-1 flex-1 rounded-full ${j <= i ? 'bg-gold' : 'bg-night/10'}`} />)}</span>
          <button type="button" onClick={() => finish()} className="text-[12.5px] text-muted underline" data-skip-onboarding>تخطَّ وابدأ</button>
        </div>
        <div className="flex-1">{body[step]}</div>
        <div className="mt-8 flex gap-2">
          {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="press flex h-12 w-12 items-center justify-center rounded-full ring-1 ring-line" aria-label="السابق"><Icon name="chevron" /></button>}
          <button type="button" onClick={() => (step === 'check' ? finish('guided') : next())} className="press h-12 flex-1 rounded-full bg-gold text-[14px] font-semibold text-white" data-onboarding-next>{step === 'hello' ? 'لنبدأ' : step === 'check' ? 'إلى رحلتي الموجّهة' : 'التالي'}</button>
        </div>
      </div>
    </Chrome>
  )
}

function Q({ t, children }: { t: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={t} className="space-y-2.5">
      <h1 className="mb-4 font-arabic-display text-[22px] font-bold">{t}</h1>
      {children}
    </div>
  )
}
