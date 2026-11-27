import { useEffect, useState } from 'react'
import { fromGIndex, gIndex, loadHafs, surah } from '../../../lib/quran'
import { Icon, toAr, useProto } from '../core'
import { guided } from '../learning/store'
import { MISTAKE_AR } from '../learning/contracts'
import { useAudio } from '../screens/ayah'
import { useOpenInMushaf } from '../screens/mushaf'
import { clearReports, markReviewed, type Report, useReports } from './reports'
import { toolButton } from './ModelManager'
import { variantName } from './ModelManager'

export const observationLabel = { suspected: 'ملاحظة أولية', confirmed: 'أكّدها المحرك', resolved: 'صُححت أثناء التلاوة', uncertain: 'غير مؤكدة' }

function Text({s, a, w}: {s: number; a: number; w?: number}) {
  const [text, setText] = useState('')
  useEffect(() => {
    let live = true
    setText('')
    void loadHafs(s).then((value) => { if (live) setText(value[a - 1] ?? '') }, () => {})
    return () => { live = false }
  }, [s, a])
  if (!text) return null
  return <p className="mf-text text-lg leading-loose">{text.split(/\s+/).filter(Boolean).map((word, i) =>
    <span key={i} className={i === w ? 'rounded bg-gold-soft' : undefined}>{word}{' '}</span>)}</p>
}

export function RecitationReport({ report }: { report: Report }) {
  const { go } = useProto()
  const open = useOpenInMushaf()
  const [picked, setPicked] = useState(0)
  const refs = report.recited
  const issue = report.observations[picked]
  const selection = issue ?? refs[0]
  const audio = useAudio(selection?.s ?? 1)
  const issueCount = report.observations.filter((o) => o.state === 'confirmed').length
  const uncertain = report.uncertain
  const endpoint = (g: number) => { const [s, a] = fromGIndex(g); return surah(s).ar + ' ' + toAr(a) }
  const retry = (s: number, a: number) => {
    const g = gIndex(s, a)
    go('recite', g + '-' + g)
  }
  return (
    <section className="space-y-2 rounded-[20px] bg-card p-4 ring-1 ring-line" data-smart-report>
      <h3 className="font-semibold">تقرير التسميع</h3>
      <p className="text-sm text-muted">{toAr(Math.round(report.ms / 1000))} ثانية · {variantName[report.model]} · {toAr(issueCount)} ملاحظة أكّدها المحرك</p>
      {report.selected && <p className="text-sm">النطاق المختار: {endpoint(report.selected.g0)} – {endpoint(report.selected.g1)}</p>}
      <p className="text-sm">{refs.length ? 'الآيات التي حدّدها المحرك: ' + refs.slice(0, 12).map(({s,a}) => surah(s).ar + ' ' + toAr(a)).join('، ') + (refs.length > 12 ? '…' : '') : 'لم يحدّد المحرك أي آية بثقة.'}</p>
      {uncertain.length > 0 && <p className="text-sm text-muted">مواضع لم يتيقّن منها المحرك: {uncertain.slice(0, 12).map(({s,a,w}) => surah(s).ar + ' ' + toAr(a) + ' (كلمة ' + toAr(w + 1) + ')').join('، ')}{uncertain.length > 12 && '…'}</p>}
      {report.observations.length > 0 && <label className="grid gap-1 text-sm">ملاحظات المحرك
        <select className="min-h-11 rounded-lg bg-card px-2 ring-1 ring-line" value={picked} onChange={(e) => { audio.stop(); setPicked(Number(e.target.value)) }}>
        {report.observations.map((o, i) => <option key={o.id} value={i}>{surah(o.s).ar} {toAr(o.a)} · كلمة {toAr(o.w + 1)} · {MISTAKE_AR[o.type]} · {observationLabel[o.state]}{o.reviewed ? ' · روجعت' : ''}</option>)}
        </select>
      </label>}
      {selection && <>
        <Text s={selection.s} a={selection.a} w={issue?.w} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={toolButton} onClick={() => open(selection.s, selection.a)}>افتح الآية</button>
          <button type="button" className={toolButton} onClick={() => retry(selection.s, selection.a)}>أعد تسميع الآية</button>
          <button type="button" className={toolButton} onClick={() => audio.a === selection.a ? audio.stop() : audio.play(selection.a)}><Icon name="play" size={13} className="inline" /> {audio.a === selection.a ? 'أوقف الاستماع' : 'استمع للتلاوة المرجعية'}</button>
          {issue && <>
            <button type="button" className={toolButton} onClick={() => guided.addWeak(issue.s, issue.a, [issue.w])}>أضف إلى مواضع المراجعة</button>
            <button type="button" className={toolButton} disabled={issue.reviewed} onClick={() => markReviewed(report.id, issue.id)}>تمت المراجعة</button>
          </>}
        </div>
      </>}
    </section>
  )
}

export function RecitationHistory() {
  const reports = useReports()
  const [confirm, setConfirm] = useState(false)
  return reports.length === 0
    ? <p className="p-3 text-sm text-muted" data-engine-empty>لا توجد تقارير تسميع آلي محفوظة.</p>
    : <div className="space-y-3">
      {reports.map((r) => <details key={r.id}><summary className="min-h-11 cursor-pointer px-2 py-2 text-sm">{new Date(r.at).toLocaleString('ar')} · {toAr(r.observations.length)} ملاحظة</summary><RecitationReport report={r} /></details>)}
      {confirm
        ? <div className="flex flex-wrap gap-2"><button type="button" className={toolButton} onClick={() => { clearReports(); setConfirm(false) }}>أكّد حذف تقارير التسميع</button><button type="button" className={toolButton} onClick={() => setConfirm(false)}>تراجع</button></div>
        : <button type="button" className={toolButton} onClick={() => setConfirm(true)}>احذف سجل التسميع</button>}
    </div>
}
