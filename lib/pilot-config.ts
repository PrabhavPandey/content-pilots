export type PilotMeta = {
  linkrunnerUrl: string
  budget?: number      // INR, no paise
  videoCount?: number  // UGC pilots only
  views?: number       // total views generated — updated manually from agency screenshots
}

export const PILOT_META: Record<string, PilotMeta> = {
  'eastern-monk': { linkrunnerUrl: 'https://link.tal.af/?c=osBZBZ', budget: 177000 },
  'aarchi':       { linkrunnerUrl: 'https://link.tal.af/?c=STKnPc', budget: 60000,  videoCount: 72  },
  'yoursbossy':   { linkrunnerUrl: 'https://link.tal.af/?c=lbOtUm' },
  'dot':          { linkrunnerUrl: 'https://link.tal.af/?c=LAtBdF', budget: 283200, videoCount: 75  },
  'the-other':    { linkrunnerUrl: 'https://link.tal.af/?c=glrEWM', budget: 288500 },
  'third-draft':  { linkrunnerUrl: 'https://link.tal.af/?c=wPPtfW', budget: 236000, videoCount: 120 },
}

export function getPilotMeta(slug: string): PilotMeta | undefined {
  return PILOT_META[slug?.toLowerCase().trim() ?? '']
}

export function formatInr(n: number): string {
  return '₹' + n.toLocaleString('en-IN')
}
