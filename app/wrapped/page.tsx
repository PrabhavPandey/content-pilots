'use client'

import { useState, useEffect, useRef } from 'react'

// ── count-up hook — runs once on mount (component is keyed so it remounts per slide) ──
function useCountUp(target: number, duration: number, startDelay = 0) {
  const [count, setCount]   = useState(0)
  const [done,  setDone]    = useState(false)
  const rafRef  = useRef<number | undefined>(undefined)
  const startTs = useRef<number | undefined>(undefined)

  useEffect(() => {
    const kick = setTimeout(() => {
      startTs.current = undefined
      const tick = (ts: number) => {
        if (!startTs.current) startTs.current = ts
        const p = Math.min((ts - startTs.current) / duration, 1)
        const e = 1 - Math.pow(1 - p, 3) // ease-out cubic
        setCount(Math.round(e * target))
        if (p < 1) { rafRef.current = requestAnimationFrame(tick) }
        else       { setCount(target); setTimeout(() => setDone(true), 380) }
      }
      rafRef.current = requestAnimationFrame(tick)
    }, startDelay)
    return () => { clearTimeout(kick); if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, []) // empty — component remounts on slide change via key prop

  return { count, done }
}

// ── formatters ────────────────────────────────────────────────────────────────
const us  = (n: number) => n.toLocaleString('en-US')
const cmp = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(1)}K`
  : us(n)

// ── slide data ────────────────────────────────────────────────────────────────
const SLIDES = [
  {
    type:    'title' as const,
    eyebrow: 'tal · ugc pilots',
    headline:'may 2026.',
    sub:     'aarchi & third draft films · 26 days in',
    color:   '#fff',
    bg:      '#0D0D0D',
    glow:    'rgba(255,255,255,0.07)',
  },
  {
    type:    'stat' as const,
    raw:     120,
    prefix:  '',
    compact: null,
    label:   'videos made.',
    sub:     'two agencies. one bet on content.',
    color:   '#FCD34D',
    bg:      '#0E0C00',
    glow:    'rgba(252,211,77,0.18)',
    ms:      800,
  },
  {
    type:    'stat' as const,
    raw:     11900000,
    prefix:  '',
    compact: '11.9M',
    label:   'views generated.',
    sub:     'organic. no paid amplification. ever.',
    color:   '#22D3EE',
    bg:      '#000C10',
    glow:    'rgba(34,211,238,0.18)',
    ms:      1700,
  },
  {
    type:    'stat' as const,
    raw:     5959,
    prefix:  '',
    compact: null,
    label:   'app installs.',
    sub:     'content did what ads take a budget to do.',
    color:   '#C084FC',
    bg:      '#0A0010',
    glow:    'rgba(192,132,252,0.18)',
    ms:      1200,
  },
  {
    type:    'stat' as const,
    raw:     4221,
    prefix:  '',
    compact: null,
    label:   'people onboarded.',
    sub:     '70.8% of installs. on a consumer app. in 26 days.',
    color:   '#FDE047',
    bg:      '#0D0B00',
    glow:    'rgba(253,224,71,0.15)',
    ms:      1100,
  },
  {
    type:    'stat' as const,
    raw:     789,
    prefix:  '',
    compact: null,
    label:   'qualified professionals.',
    sub:     'swes. pms. designers. your icp — found through content.',
    color:   '#4ADE80',
    bg:      '#00100A',
    glow:    'rgba(74,222,128,0.22)',
    ms:      2000,
    accent:  true,
  },
  {
    type:    'compare' as const,
    label:   'cost per install.',
    left:    { raw: 44,  label: '₹44',  sub: 'your content', color: '#4ADE80' },
    right:   { raw: 120, label: '₹120', sub: 'linkedin ads', color: 'rgba(255,255,255,0.25)' },
    sub:     'linkedin stops the moment you stop paying. content doesn\'t.',
    bg:      '#00100A',
    glow:    'rgba(74,222,128,0.12)',
  },
  {
    type:    'stat' as const,
    raw:     22,
    prefix:  '₹',
    compact: null,
    label:   'cost per 1,000 views.',
    sub:     'and this number gets better every day the videos stay up.',
    color:   '#2DD4BF',
    bg:      '#000D0B',
    glow:    'rgba(45,212,191,0.18)',
    ms:      700,
  },
  {
    type:     'end' as const,
    headline: 'content works.',
    sub:      'day 26. still running.',
    bg:       '#0D0D0D',
    glow:     'rgba(255,255,255,0.04)',
    stats: [
      { v: '11.9M', l: 'views',        color: '#22D3EE' },
      { v: '5,959', l: 'installs',     color: '#C084FC' },
      { v: '789',   l: 'qualified',    color: '#4ADE80' },
      { v: '₹22',   l: 'cpm',          color: '#2DD4BF' },
      { v: '₹44',   l: 'cost/install', color: '#FCD34D' },
      { v: '120',   l: 'videos',       color: '#FDE047' },
    ],
  },
]

// ── sub-components ────────────────────────────────────────────────────────────

function TitleSlide({ s }: { s: typeof SLIDES[0] & { type: 'title' } }) {
  return (
    <div style={C.content}>
      <p style={C.eyebrow}>{s.eyebrow}</p>
      <h1 style={{ ...C.num, fontSize: 'clamp(56px,13vw,100px)', color: s.color, letterSpacing: '-0.03em' }}>
        {s.headline}
      </h1>
      <p style={C.sub}>{s.sub}</p>
    </div>
  )
}

function StatSlide({ s }: { s: Extract<typeof SLIDES[number], { type: 'stat' }> }) {
  const { count, done } = useCountUp(s.raw, s.ms)
  const raw     = `${s.prefix}${us(count)}`
  const compact = s.compact ? `${s.prefix}${s.compact}` : raw
  const display = done && s.compact ? compact : raw

  return (
    <div style={C.content}>
      <div
        style={{
          ...C.num,
          color: s.color,
          fontSize: 'clamp(76px,19vw,148px)',
          textShadow: `0 0 80px ${s.color}40`,
          transition: done ? 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
          transform: done && s.compact ? 'scale(1.04)' : 'scale(1)',
          animation: 'slideUp 0.45s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        {display}
      </div>
      <p style={{ ...C.label, color: `${s.color}90`, animation: 'slideUp 0.45s 0.1s cubic-bezier(0.16,1,0.3,1) both' }}>
        {s.label}
      </p>
      <p style={{ ...C.sub, animation: 'slideUp 0.45s 0.2s cubic-bezier(0.16,1,0.3,1) both' }}>
        {s.sub}
      </p>
      {s.accent && done && (
        <div style={{ marginTop: 32, animation: 'fadeIn 0.6s ease both' }}>
          <div style={{ height: 2, width: 48, background: s.color, margin: '0 auto', borderRadius: 2 }} />
        </div>
      )}
    </div>
  )
}

function CompareSlide({ s }: { s: Extract<typeof SLIDES[number], { type: 'compare' }> }) {
  const l = useCountUp(s.left.raw,  1100, 0)
  const r = useCountUp(s.right.raw, 1300, 180)

  return (
    <div style={C.content}>
      <p style={{ ...C.eyebrow, marginBottom: 36, animation: 'slideUp 0.45s cubic-bezier(0.16,1,0.3,1) both' }}>
        {s.label}
      </p>
      <div style={{ display: 'flex', gap: 0, justifyContent: 'center', marginBottom: 36 }}>
        {/* LEFT — your content */}
        <div style={{ ...C.compareCol, animation: 'slideUp 0.45s 0.05s cubic-bezier(0.16,1,0.3,1) both' }}>
          <div style={{ ...C.num, fontSize: 'clamp(56px,13vw,96px)', color: s.left.color, textShadow: `0 0 60px ${s.left.color}50` }}>
            ₹{us(l.count)}
          </div>
          <p style={{ ...C.label, color: `${s.left.color}80`, marginTop: 10 }}>{s.left.sub}</p>
        </div>

        {/* divider */}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 32px', alignSelf: 'stretch' }} />

        {/* RIGHT — linkedin */}
        <div style={{ ...C.compareCol, animation: 'slideUp 0.45s 0.15s cubic-bezier(0.16,1,0.3,1) both' }}>
          <div style={{ ...C.num, fontSize: 'clamp(56px,13vw,96px)', color: s.right.color, textDecoration: 'line-through', textDecorationColor: 'rgba(255,80,80,0.5)' }}>
            ₹{us(r.count)}
          </div>
          <p style={{ ...C.label, color: 'rgba(255,255,255,0.22)', marginTop: 10 }}>{s.right.sub}</p>
        </div>
      </div>
      <p style={{ ...C.sub, animation: 'slideUp 0.45s 0.25s cubic-bezier(0.16,1,0.3,1) both' }}>{s.sub}</p>
    </div>
  )
}

function EndSlide({ s }: { s: Extract<typeof SLIDES[number], { type: 'end' }> }) {
  return (
    <div style={{ ...C.content, maxWidth: 520 }}>
      <p style={{ ...C.eyebrow, animation: 'slideUp 0.45s cubic-bezier(0.16,1,0.3,1) both' }}>
        tal · ugc pilots
      </p>
      <h2 style={{
        ...C.num, fontSize: 'clamp(52px,12vw,92px)', color: '#fff',
        marginBottom: 16, animation: 'slideUp 0.45s 0.05s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        {s.headline}
      </h2>
      <p style={{ ...C.sub, marginBottom: 48, animation: 'slideUp 0.45s 0.1s cubic-bezier(0.16,1,0.3,1) both' }}>
        {s.sub}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {s.stats.map(({ v, l, color }, i) => (
          <div
            key={l}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${color}22`,
              borderRadius: 14,
              padding: '16px 10px',
              textAlign: 'center',
              animation: `slideUp 0.45s ${0.15 + i * 0.06}s cubic-bezier(0.16,1,0.3,1) both`,
            }}
          >
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 22, fontWeight: 700, color, marginBottom: 5 }}>
              {v}
            </div>
            <div style={{ fontFamily: 'var(--font-inconsolata)', fontSize: 10, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.35)' }}>
              {l}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function WrappedPage() {
  const [idx,     setIdx]     = useState(0)
  const [animKey, setAnimKey] = useState(0)

  const go = (dir: 1 | -1) => {
    const next = idx + dir
    if (next < 0 || next >= SLIDES.length) return
    setIdx(next)
    setAnimKey(k => k + 1)
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [idx])

  const slide  = SLIDES[idx]
  const isLast = idx === SLIDES.length - 1

  return (
    <div
      onClick={() => go(1)}
      style={{
        minHeight: '100dvh',
        background: slide.bg,
        transition: 'background 0.7s cubic-bezier(0.16,1,0.3,1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isLast ? 'default' : 'pointer',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        padding: '64px 32px 80px',
      }}
    >
      {/* Radial glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 700, height: 700, borderRadius: '50%',
        background: `radial-gradient(circle, ${slide.glow} 0%, transparent 68%)`,
        pointerEvents: 'none',
        transition: 'background 0.7s ease',
      }} />

      {/* Noise grain overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.025,
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        backgroundSize: '200px 200px',
        pointerEvents: 'none',
      }} />

      {/* Progress dots */}
      <div style={{ position: 'absolute', top: 26, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
        {SLIDES.map((sl, i) => {
          const c = 'color' in sl ? sl.color : '#fff'
          return (
            <div key={i} style={{
              width: i === idx ? 22 : 6, height: 6, borderRadius: 3,
              background: i === idx ? c : 'rgba(255,255,255,0.14)',
              transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
            }} />
          )
        })}
      </div>

      {/* Slide */}
      {slide.type === 'title'   && <TitleSlide   key={animKey} s={slide as any} />}
      {slide.type === 'stat'    && <StatSlide    key={animKey} s={slide as any} />}
      {slide.type === 'compare' && <CompareSlide key={animKey} s={slide as any} />}
      {slide.type === 'end'     && <EndSlide     key={animKey} s={slide as any} />}

      {/* Tap hint */}
      {!isLast && (
        <p style={{ position: 'absolute', bottom: 26, fontFamily: 'var(--font-inconsolata)', fontSize: 11, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.18)', animation: 'pulse 2.2s ease-in-out infinite' }}>
          tap to continue
        </p>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateY(26px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes pulse {
          0%,100% { opacity:0.18; }
          50%     { opacity:0.45; }
        }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}

// ── shared style constants ────────────────────────────────────────────────────
const C = {
  content: {
    textAlign:  'center'    as const,
    maxWidth:   580,
    width:      '100%',
    position:   'relative'  as const,
    zIndex:     1,
  },
  num: {
    fontFamily:    'var(--font-poppins)',
    fontWeight:    700,
    lineHeight:    0.9,
    letterSpacing: '-0.03em',
    marginBottom:  20,
    display:       'block',
  },
  label: {
    fontFamily:    'var(--font-inconsolata)',
    fontSize:      17,
    letterSpacing: '0.1em',
    marginBottom:  16,
    display:       'block',
  },
  sub: {
    fontFamily: 'var(--font-inconsolata)',
    fontSize:   17,
    color:      'rgba(255,255,255,0.52)',
    maxWidth:   380,
    margin:     '0 auto',
    lineHeight: 1.65,
    display:    'block',
  },
  eyebrow: {
    fontFamily:    'var(--font-inconsolata)',
    fontSize:      12,
    letterSpacing: '0.22em',
    color:         'rgba(255,255,255,0.35)',
    marginBottom:  20,
    display:       'block',
  },
  compareCol: {
    flex:          1,
    display:       'flex'           as const,
    flexDirection: 'column'        as const,
    alignItems:    'center'        as const,
    textAlign:     'center'        as const,
  },
}
