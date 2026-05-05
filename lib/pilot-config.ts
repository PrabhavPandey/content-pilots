export type PilotMeta = {
  linkrunnerUrl: string
  budget?: number  // INR, no paise
}

export const PILOT_META: Record<string, PilotMeta> = {
  'eastern-monk': { linkrunnerUrl: 'https://link.tal.af/?c=osBZBZ', budget: 177000 },
  'aarchi':       { linkrunnerUrl: 'https://link.tal.af/?c=STKnPc', budget: 60000 },
  'yoursbossy':   { linkrunnerUrl: 'https://link.tal.af/?c=lbOtUm' },
  'dot':          { linkrunnerUrl: 'https://link.tal.af/?c=LAtBdF', budget: 283200 },
  'the-other':    { linkrunnerUrl: 'https://link.tal.af/?c=glrEWM', budget: 288500 },
  'third-draft':  { linkrunnerUrl: 'https://link.tal.af/?c=wPPtfW', budget: 236000 },
}

export function getPilotMeta(slug: string): PilotMeta | undefined {
  return PILOT_META[slug?.toLowerCase().trim() ?? '']
}

export function formatInr(n: number): string {
  return '₹' + n.toLocaleString('en-IN')
}
