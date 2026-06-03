const BASE = 'https://api.linkrunner.io/api/v1/reporting/campaigns'
const KEY = process.env.LINKRUNNER_API_KEY!
const TARGETS = ['tdf1','tdf2','tdf3','tdf4','tdf5','tdf6','tdf7','tdf8','tdf9','tdf10']

async function fetchP(params: Record<string,string>) {
  const url = new URL(BASE)
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { headers: { 'linkrunner-key': KEY } })
  return { status: res.status, body: res.ok ? await res.json() : await res.text() }
}
const wait = (s: number) => new Promise(r => setTimeout(r, s*1000))

async function main() {
  console.log('waiting 65s for rate limit...')
  await wait(65)

  // Test 1: search param
  console.log('\n=== search=tdf ===')
  let r = await fetchP({ limit: '100', search: 'tdf' })
  if (typeof r.body === 'string') {
    console.log('status', r.status, r.body.slice(0,120))
  } else {
    const c: any[] = r.body?.data?.campaigns ?? []
    console.log('pagination:', JSON.stringify(r.body?.data?.pagination))
    console.log('returned:', c.length)
    console.log('names:', c.map(x=>(x.name??'').toLowerCase().trim()).join(', '))
    const found = TARGETS.filter(t => c.some(x=>(x.name??'').toLowerCase().trim()===t))
    console.log('TARGETS found via search:', found)
    for (const x of c) {
      const n=(x.name??'').toLowerCase().trim()
      if (TARGETS.includes(n)) console.log(`  ${n}: clicks=${x.clicks} installs=${x.installs} signups=${x['sign-ups']}`)
    }
  }

  await wait(65)
  // Test 2: page 1 + page 2 with limit=100, find all targets
  console.log('\n=== page 1 (limit=100) ===')
  r = await fetchP({ limit: '100', page: '1' })
  const p1: any[] = (r.body as any)?.data?.campaigns ?? []
  console.log('pagination:', JSON.stringify((r.body as any)?.data?.pagination), 'count:', p1.length)
  const f1 = TARGETS.filter(t => p1.some(x=>(x.name??'').toLowerCase().trim()===t))
  console.log('targets on p1:', f1)

  await wait(65)
  console.log('\n=== page 2 (limit=100) ===')
  r = await fetchP({ limit: '100', page: '2' })
  const p2: any[] = (r.body as any)?.data?.campaigns ?? []
  console.log('count:', p2.length)
  const f2 = TARGETS.filter(t => p2.some(x=>(x.name??'').toLowerCase().trim()===t))
  console.log('targets on p2:', f2)
  for (const x of [...p1,...p2]) {
    const n=(x.name??'').toLowerCase().trim()
    if (TARGETS.includes(n)) console.log(`  ${n}: clicks=${x.clicks} installs=${x.installs} signups=${x['sign-ups']}`)
  }
}
main().catch(console.error)
