import { getAllCampaignInstalls } from '../lib/mixpanel'
import { getOnboardedUsers } from '../lib/metabase'

const CREATOR_SLUGS = ['tdf1','tdf2','tdf3','tdf4','tdf5','tdf6','tdf7','tdf8','tdf9','tdf10']

async function main() {
  console.log('Fetching phones from Mixpanel...')
  const map = await getAllCampaignInstalls(CREATOR_SLUGS)
  const phones = new Set<string>()
  for (const slug of CREATOR_SLUGS) {
    map.get(slug)?.users?.forEach((u: any) => { if (u.phone) phones.add(u.phone) })
  }
  console.log(`Mixpanel: ${phones.size} unique phones`)

  // Test Metabase with just the first batch of 500
  const sample = [...phones].slice(0, 500)
  console.log(`\nTesting Metabase with first 500 phones...`)
  try {
    const users = await getOnboardedUsers(sample)
    console.log(`Metabase returned: ${users.length} users from 500 phones`)
    if (users.length > 0) {
      console.log('Sample:', JSON.stringify(users.slice(0,2), null, 2))
    }
  } catch (err: any) {
    console.log('Metabase ERROR:', err.message)
  }

  // Test with second batch
  const sample2 = [...phones].slice(500, 1000)
  console.log(`\nTesting Metabase with phones 500-1000...`)
  try {
    const users2 = await getOnboardedUsers(sample2)
    console.log(`Metabase returned: ${users2.length} users from 500 phones`)
  } catch (err: any) {
    console.log('Metabase ERROR:', err.message)
  }
}

main().catch(console.error)
