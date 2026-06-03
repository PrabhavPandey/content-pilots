import { getAllCampaignInstalls } from '../lib/mixpanel'
import { getOnboardedUsers } from '../lib/metabase'
import { batchClassifyUsers, buildCacheKey } from '../lib/gemini'

async function main() {
  console.log('📱 Fetching Mixpanel attribution for tdf10...')
  const mpMap = await getAllCampaignInstalls(['tdf10'])
  const bucket = mpMap.get('tdf10')
  if (!bucket) { console.log('No Mixpanel data for tdf10'); return }

  const phones = bucket.users.map((u: any) => u.phone).filter(Boolean)
  console.log(`   ${phones.length} attributed users, ${bucket.first_app_opens} first app opens`)

  console.log('🔍 Metabase lookup...')
  const metaUsers = await getOnboardedUsers(phones)
  console.log(`   ${metaUsers.length} have profiles (${phones.length - metaUsers.length} no profile)`)

  console.log('🤖 Gemini classification...')
  const classMap = await batchClassifyUsers(
    metaUsers.map(u => ({ company: u.company ?? '', jobRole: u.job_role })),
    'ugc'
  )

  let qualified = 0, notQualified = 0, noCompany = 0
  for (const u of metaUsers) {
    if (!u.company?.trim()) { noCompany++; continue }
    const entry = classMap.get(buildCacheKey(u.company, u.job_role, 'ugc'))
    entry?.qualified ? qualified++ : notQualified++
  }

  const pct = (a: number, b: number) => b ? `${((a/b)*100).toFixed(1)}%` : '—'
  console.log(`\n── tdf10 quality metrics ───────────────`)
  console.log(`  Mixpanel installs:   ${phones.length}`)
  console.log(`  Have TAL profile:    ${metaUsers.length}  (${pct(metaUsers.length, phones.length)})`)
  console.log(`  ✅ Qualified:        ${qualified}  (${pct(qualified, metaUsers.length)} of profiled)`)
  console.log(`  ❌ Not qualified:    ${notQualified}`)
  console.log(`  ⚪ No company:       ${noCompany}`)
  console.log(`  Overall qual rate:   ${pct(qualified, phones.length)}`)
}
main().catch(console.error)
