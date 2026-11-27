import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const memory = new Map()
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null, setItem: (key,value) => memory.set(key,value),
  key: (i) => [...memory.keys()][i] ?? null, get length() { return memory.size },
}
const server = await createServer({root,configFile:false,logLevel:'error',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false},resolve:{alias:{'@':resolve(root,'src')}}})
try {
  const {gIndex} = await server.ssrLoadModule(resolve(root,'src/lib/quran.ts'))
  const load = (n) => server.ssrLoadModule(resolve(root,'src/studio/next/tilawa',n))
  const {insidePassage, mapWords} = await load('mapping.ts')
  const {splitPassage} = await load('SmartTasmee.tsx')
  const models = await load('models.ts')
  const logs = await load('reports.ts')

  assert.deepEqual(splitPassage({g0:gIndex(1,6),g1:gIndex(2,21)}), [{s:1,from:6,to:7},{s:2,from:1,to:21}])
  assert.deepEqual(splitPassage({g0:gIndex(2,1),g1:gIndex(2,286)}), [{s:2,from:1,to:286}])
  assert.deepEqual([...mapWords(['الحمد','لله'],'۞ ٱلْحَمْدُ لِلَّهِ')], [[1,1],[2,2]])
  assert.deepEqual([...mapWords(['كلام','جديد'],'كلام آخر')], [])
  assert.deepEqual([...mapWords(['عبدالله','كريم'],'عبد الله كريم')], [[2,2]])
  assert.equal(insidePassage(112,1,{s:113,from:1,to:1}),false)
  assert.equal(insidePassage(113,2,{s:113,from:1,to:1}),false)
  assert.equal(insidePassage(113,1,{s:113,from:1,to:1}),true)
  assert.equal(models.modelCacheUrl('light'), 'https://tilawa.models/spliced-clean-lite@1-int8/model.onnx')
  assert.equal(models.supportedDevice(), false)

  const observed = new Map()
  const issue = {kind:'observation',id:'issue-a',s:1,a:2,w:0,type:'missing-word',state:'suspected'}
  logs.latestObservation(observed, issue)
  logs.latestObservation(observed, {...issue,state:'resolved'})
  assert.deepEqual([...observed.values()].map((x)=>x.state),['resolved'])
  memory.set('quranJourney.production.v1','learning-safe')
  const report = {id:'take-a',at:'2026-11-28T00:00:00.000Z',ms:2200,model:'light',engine:models.SDK_VERSION,recited:[{s:1,a:2}],uncertain:[],observations:[...observed.values()]}
  assert.equal(logs.saveReport(report),true)
  assert.equal(logs.saveReport(report),true)
  assert.equal(logs.markReviewed(report.id,issue.id),true)
  const key = 'quranJourney.production.tilawaReports.v1'
  const saved = JSON.parse(memory.get(key))
  assert.equal(saved.sessions.length,1)
  assert.equal(saved.sessions[0].observations[0].reviewed,true)
  assert.deepEqual(Object.keys(saved.sessions[0]).sort(),['at','engine','id','model','ms','observations','recited','uncertain'])
  assert.equal(logs.clearReports(),true)
  assert.deepEqual(JSON.parse(memory.get(key)).sessions,[])
  assert.equal(memory.get('quranJourney.production.v1'),'learning-safe')
  memory.set(key,'damaged original')
  assert.equal(logs.saveReport(report),true)
  assert.ok([...memory].some(([k,v])=> k.startsWith(key+'.recovery.') && v==='damaged original'))
  console.log('Passed Tilawa scope, mapping, cache key, observation deduplication, report storage and recovery checks.')
} finally { await server.close() }
process.exit(0)
