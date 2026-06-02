/**
 * One-off: qualify Meta ads leads from LinkRunner CSV export.
 * Run: npx tsx scripts/analyze-meta-leads.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { getOnboardedUsers } from '../lib/metabase'
import { batchClassifyUsers, buildCacheKey } from '../lib/gemini'

const CSV_PATH = path.join(process.env.HOME!, 'Downloads/LR_axfu78_users_Jun_01_2026_07_57_PM.csv')

const phones: string[] = fs.readFileSync(CSV_PATH, 'utf-8').trim().split('\n').slice(1)
  .map(line => {
    const userId = line.split(',')[1]?.trim()
    if (!userId || userId === 'N/A') return null
    const phone = userId.startsWith('91') ? userId.slice(2) : userId
    return phone.length === 10 ? phone : null
  })
  .filter(Boolean) as string[]

console.log(`📱 ${phones.length} phones extracted`)

async function main() {
  console.log(`🔍 Metabase lookup...`)
  const metaUsers = await getOnboardedUsers(phones)
  console.log(`   ${metaUsers.length} profiles found`)

  console.log(`🤖 Gemini classification (results mostly cached)...`)
  const classMap = await batchClassifyUsers(
    metaUsers.map(u => ({ company: u.company ?? '', jobRole: u.job_role })),
    'ugc'
  )

  // Build rows
  const rows = metaUsers.map(u => {
    const key = buildCacheKey(u.company ?? '', u.job_role, 'ugc')
    const entry = u.company?.trim() ? classMap.get(key) : undefined
    const qualified = entry?.qualified ?? false
    const reason = entry?.reason ?? (u.company?.trim() ? '' : 'no company data')
    return { ...u, qualified, reason }
  })

  // Summary
  const q = rows.filter(r => r.qualified).length
  const noComp = rows.filter(r => !r.company?.trim()).length
  console.log(`\n  ✅ Qualified: ${q} / ${rows.length}  (${((q/rows.length)*100).toFixed(1)}%)`)
  console.log(`  ⚪ No company data: ${noComp}`)

  // Write CSV
  const OUT = path.join(process.env.HOME!, 'Downloads/meta-leads-qualified.csv')
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [
    ['Name', 'Company', 'Job Role', 'LinkedIn', 'Qualified', 'Reason'].map(esc).join(','),
    ...rows.map(r => [
      r.name ?? '',
      r.company ?? '',
      r.job_role ?? '',
      r.linkedin ?? '',
      r.qualified ? 'Yes' : 'No',
      r.reason ?? '',
    ].map(esc).join(','))
  ]
  fs.writeFileSync(OUT, lines.join('\n'))
  console.log(`\n✅ Saved to ~/Downloads/meta-leads-qualified.csv`)
}

main().catch(console.error)
