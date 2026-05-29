export type PilotMeta = {
  linkrunnerUrl: string
  budget?: number      // INR, no paise
  videoCount?: number  // UGC pilots only
  views?: number       // total views generated — updated manually from agency screenshots
}

export const PILOT_META: Record<string, PilotMeta> = {
  'eastern-monk': { linkrunnerUrl: 'https://link.tal.af/?c=osBZBZ', budget: 177000 },
  'aarchi':       { linkrunnerUrl: 'https://link.tal.af/?c=STKnPc', budget: 60000,  videoCount: 72,  views: 1700000 },
  'yoursbossy':   { linkrunnerUrl: 'https://link.tal.af/?c=lbOtUm', budget: 205000 },
  'the-other':    { linkrunnerUrl: 'https://link.tal.af/?c=glrEWM', budget: 288500 },
  'third-draft':  { linkrunnerUrl: 'https://link.tal.af/?c=wPPtfW', budget: 200000, videoCount: 120, views: 10200000 },
}

export function getPilotMeta(slug: string): PilotMeta | undefined {
  return PILOT_META[slug?.toLowerCase().trim() ?? '']
}

export function formatInr(n: number): string {
  return '₹' + n.toLocaleString('en-IN')
}
