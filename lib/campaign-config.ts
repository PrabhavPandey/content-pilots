// Campaign mode config — graduated campaigns (TDF + Aarchi)
// Each campaign has N creator-level Linkrunner slugs.
// One card per campaign, expandable to per-creator rows.

export type CreatorMeta = {
  slug: string         // linkrunner campaign name e.g. 'tdf10'
  label: string        // display label e.g. 'tdf-10'
  linkrunnerUrl: string
}

export type CampaignMeta = {
  name: string
  type: 'ugc' | 'influencer'
  creators: CreatorMeta[]
  budget?: number
}

export const CAMPAIGN_META: Record<string, CampaignMeta> = {
  'tdf': {
    name: 'Third Draft Films',
    type: 'ugc',
    creators: [
      { slug: 'tdf1',  label: 'tdf-1',  linkrunnerUrl: 'https://link.tal.af/?c=DtyyyJ' },
      { slug: 'tdf2',  label: 'tdf-2',  linkrunnerUrl: 'https://link.tal.af/?c=mSmGzi' },
      { slug: 'tdf3',  label: 'tdf-3',  linkrunnerUrl: 'https://link.tal.af/?c=GwPjYA' },
      { slug: 'tdf4',  label: 'tdf-4',  linkrunnerUrl: 'https://link.tal.af/?c=YdXvRi' },
      { slug: 'tdf5',  label: 'tdf-5',  linkrunnerUrl: 'https://link.tal.af/?c=klhvPu' },
      { slug: 'tdf6',  label: 'tdf-6',  linkrunnerUrl: 'https://link.tal.af/?c=gRimdX' },
      { slug: 'tdf7',  label: 'tdf-7',  linkrunnerUrl: 'https://link.tal.af/?c=QTivaZ' },
      { slug: 'tdf8',  label: 'tdf-8',  linkrunnerUrl: 'https://link.tal.af/?c=QctWfm' },
      { slug: 'tdf9',  label: 'tdf-9',  linkrunnerUrl: 'https://link.tal.af/?c=XqPIDZ' },
      { slug: 'tdf10', label: 'tdf-10', linkrunnerUrl: 'https://link.tal.af/?c=GirpGY' },
    ],
  },
  'aarchi': {
    name: 'Aarchi',
    type: 'ugc',
    creators: [], // creator links TBD — add when available
  },
}

// All creator slugs across all campaigns — used by Mixpanel + Linkrunner batch calls
export function getAllCreatorSlugs(): string[] {
  return Object.values(CAMPAIGN_META).flatMap(c => c.creators.map(cr => cr.slug))
}

// Pilot linkrunner_campaign_name → campaign slug
// Used to give pilot (agency) accounts access to their campaign in campaign mode
export const PILOT_TO_CAMPAIGN: Record<string, string> = {
  'third-draft': 'tdf',
  'aarchi':      'aarchi',
}

// Creator slug → campaign slug lookup
export function slugToCampaign(): Map<string, string> {
  const map = new Map<string, string>()
  for (const [campaignSlug, meta] of Object.entries(CAMPAIGN_META)) {
    for (const creator of meta.creators) {
      map.set(creator.slug, campaignSlug)
    }
  }
  return map
}
