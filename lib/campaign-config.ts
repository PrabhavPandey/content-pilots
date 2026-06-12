// Campaign mode config — graduated campaigns (TDF + Aarchi)
// Each campaign has N creator-level Linkrunner slugs.
// One card per campaign, expandable to per-creator rows.

export type CreatorMeta = {
  slug: string         // linkrunner campaign name e.g. 'tdf10'
  label: string        // display label e.g. 'tdf-10'
  linkrunnerUrl: string
  name?: string        // creator first name (Title Case) e.g. 'Priyanshi'
  instagramUrl?: string
}

export type CampaignMeta = {
  name: string
  type: 'ugc' | 'influencer'
  creators: CreatorMeta[]
  budget?: number
  // Linkrunner search term that matches all this campaign's creator slugs in one API call.
  // Defaults to the campaign key (e.g. 'tdf' matches tdf1…tdf10).
  searchTerm?: string
}

export const CAMPAIGN_META: Record<string, CampaignMeta> = {
  'tdf': {
    name: 'Third Draft Films',
    type: 'ugc',
    searchTerm: 'tdf',
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
    searchTerm: 'aarchi',
    creators: [
      { slug: 'aarchi1',  label: 'aarchi-1',  linkrunnerUrl: 'https://link.tal.af/?c=Zrjajk' },
      { slug: 'aarchi2',  label: 'aarchi-2',  linkrunnerUrl: 'https://link.tal.af/?c=ObraPP' },
      { slug: 'aarchi3',  label: 'aarchi-3',  linkrunnerUrl: 'https://link.tal.af/?c=qiMmkt' },
      { slug: 'aarchi4',  label: 'aarchi-4',  linkrunnerUrl: 'https://link.tal.af/?c=DoILFD' },
      { slug: 'aarchi5',  label: 'aarchi-5',  linkrunnerUrl: 'https://link.tal.af/?c=YKCbwI' },
      { slug: 'aarchi6',  label: 'aarchi-6',  linkrunnerUrl: 'https://link.tal.af/?c=HbjFTU' },
      { slug: 'aarchi7',  label: 'aarchi-7',  linkrunnerUrl: 'https://link.tal.af/?c=SsyOaK' },
      { slug: 'aarchi8',  label: 'aarchi-8',  linkrunnerUrl: 'https://link.tal.af/?c=lVEgKJ' },
      { slug: 'aarchi9',  label: 'aarchi-9',  linkrunnerUrl: 'https://link.tal.af/?c=bxJTwB' },
      { slug: 'aarchi10', label: 'aarchi-10', linkrunnerUrl: 'https://link.tal.af/?c=mUMOki' },
      { slug: 'aarchi11', label: 'aarchi-11', linkrunnerUrl: 'https://link.tal.af/?c=QMEJyt' },
      { slug: 'aarchi12', label: 'aarchi-12', linkrunnerUrl: 'https://link.tal.af/?c=rjgGWv' },
      { slug: 'aarchi13', label: 'aarchi-13', linkrunnerUrl: 'https://link.tal.af/?c=wjdoYo' },
      { slug: 'aarchi14', label: 'aarchi-14', linkrunnerUrl: 'https://link.tal.af/?c=xJHtYA' },
      { slug: 'aarchi15', label: 'aarchi-15', linkrunnerUrl: 'https://link.tal.af/?c=bkdLGj' },
    ],
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
