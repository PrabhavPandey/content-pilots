'use client'

import { useState, useEffect, useCallback } from 'react'

// ── slides — update values after each sync ────────────────────────────────────
const SLIDES = [
  {
    type: 'title' as const,
    eyebrow: 'tal · ugc pilots',
    headline: 'may 2026.',
    sub: 'aarchi & third draft films',
  },
  {
    type: 'stat' as const,
    value: '120',
    label: 'videos made.',
    sub: 'two agencies. one bet on content.',
    glow: 'rgba(255,255,255,0.06)',
  },
  {
    type: 'stat' as const,
    value: '11.9M',
    label: 'views generated.',
    sub: 'organic. no paid amplification.',
    glow: 'rgba(255,255,255,0.06)',
  },
  {
    type: 'stat' as const,
    value: '5,959',
    label: 'app installs.',
    sub: 'content did what ads take a budget to do.',
    glow: 'rgba(255,255,255,0.06)',
  },
  {
    type: 'stat' as const,
    value: '4,221',
    label: 'people onboarded.',
    sub: '70.8% converted after install.',
    glow: 'rgba(255,255,255,0.06)',
  },
  {
    type: 'stat' as const,
    value: '789',
    label: 'qualified professionals.',
    sub: 'swes. pms. designers. your icp — found through content.',
    accent: true,
    glow: 'rgba(74,222,128,0.12)',
  },
  {
    type: 'compare' as const,
    label: 'cost per install.',
    left: { value: '₹44', sub: 'your content' },
    right: { value: '₹120', sub: 'linkedin ads' },
    sub: 'and content keeps working after you stop paying.',
    glow: 'rgba(255,255,255,0.06)',
  },
  {
    type: 'stat' as const,
    value: '₹22',
    label: 'cost per 1,000 views.',
    sub: 'and this compounds. every video is a permanent asset.',
    glow: 'rgba(255,255,255,0.06)',
  },
  {
    type: 'end' as const,
    headline: 'content works.',
    sub: 'day 26. still running.',
    stats: [
      { v: '11.9M', l: 'views' },
      { v: '5,959', l: 'installs' },
      { v: '789',   l: 'qualified' },
      { v: '₹22',   l: 'cpm' },
      { v: '₹44',   l: 'cost / install' },
      { v: '120',   l: 'videos' },
    ],
  },
]

export default function WrappedPage() {
  const [idx, setIdx]         = useState(0)
  const [animKey, setAnimKey] = useState(0)

  const go = useCallback((dir: 1 | -1) => {
    setIdx(i => Math.max(0, Math.min(SLIDES.length - 1, i + dir)))
    setAnimKey(k => k + 1)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1)
      if (e.key === 'ArrowLeft')                   go(-1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [go])

  const slide  = SLIDES[idx]
  const isLast = idx === SLIDES.length - 1
  const glow   = ('glow' in slide && slide.glow) ? slide.glow : 'rgba(255,255,255,0.05)'
  const isAccent = 'accent' in slide && slide.accent

  return (
    <div
      onClick={() => go(1)}
      style={{
        minHeight: '100dvh',
        background: '#0D0D0D',
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
      {/* Radial glow behind content */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600, height: 600,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
        pointerEvents: 'none',
        transition: 'background 0.6s ease',
      }} />

      {/* Progress dots */}
      <div style={{
        position: 'absolute', top: 28,
        left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 6,
      }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: i === idx ? 22 : 6,
            height: 6,
            borderRadius: 3,
            background: i === idx
              ? (isAccent ? '#4ADE80' : '#fff')
              : 'rgba(255,255,255,0.15)',
            transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
          }} />
        ))}
      </div>

      {/* Slide content */}
      <div
        key={animKey}
        style={{
          textAlign: 'center',
          maxWidth: 580,
          width: '100%',
          animation: 'up 0.5s cubic-bezier(0.16,1,0.3,1) both',
          position: 'relative',
        }}
      >
        {slide.type === 'title' && (
          <>
            <p style={styles.eyebrow}>{slide.eyebrow}</p>
            <h1 style={{ ...styles.headline, fontSize: 'clamp(56px,13vw,104px)' }}>
              {slide.headline}
            </h1>
            <p style={styles.sub}>{slide.sub}</p>
          </>
        )}

        {slide.type === 'stat' && (
          <>
            <div style={{
              ...styles.number,
              color: isAccent ? '#4ADE80' : '#fff',
              fontSize: 'clamp(80px,20vw,152px)',
            }}>
              {slide.value}
            </div>
            <p style={{ ...styles.label, color: isAccent ? 'rgba(74,222,128,0.7)' : 'rgba(255,255,255,0.55)' }}>
              {slide.label}
            </p>
            <p style={styles.sub}>{slide.sub}</p>
          </>
        )}

        {slide.type === 'compare' && (
          <>
            <p style={{ ...styles.eyebrow, marginBottom: 32 }}>{slide.label}</p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 32 }}>
              <div style={styles.compareBox}>
                <div style={{ ...styles.number, fontSize: 'clamp(52px,12vw,88px)', color: '#4ADE80' }}>
                  {slide.left.value}
                </div>
                <p style={{ ...styles.label, color: 'rgba(74,222,128,0.6)', marginTop: 8 }}>
                  {slide.left.sub}
                </p>
              </div>
              <div style={styles.compareDivider} />
              <div style={styles.compareBox}>
                <div style={{ ...styles.number, fontSize: 'clamp(52px,12vw,88px)', color: 'rgba(255,255,255,0.35)' }}>
                  {slide.right.value}
                </div>
                <p style={{ ...styles.label, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
                  {slide.right.sub}
                </p>
              </div>
            </div>
            <p style={styles.sub}>{slide.sub}</p>
          </>
        )}

        {slide.type === 'end' && (
          <>
            <p style={styles.eyebrow}>tal · ugc pilots</p>
            <h2 style={{ ...styles.headline, fontSize: 'clamp(52px,12vw,96px)' }}>
              {slide.headline}
            </h2>
            <p style={{ ...styles.sub, marginBottom: 52 }}>{slide.sub}</p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3,1fr)',
              gap: 10,
            }}>
              {slide.stats.map(({ v, l }) => (
                <div key={l} style={styles.chip}>
                  <div style={{
                    fontFamily: 'var(--font-poppins)',
                    fontSize: 24, fontWeight: 700,
                    color: '#fff', marginBottom: 4,
                  }}>{v}</div>
                  <div style={{
                    fontFamily: 'var(--font-inconsolata)',
                    fontSize: 10, letterSpacing: '0.14em',
                    textTransform: 'lowercase',
                    color: 'rgba(255,255,255,0.4)',
                  }}>{l}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Tap hint */}
      {!isLast && (
        <p style={{
          position: 'absolute', bottom: 28,
          fontFamily: 'var(--font-inconsolata)',
          fontSize: 11, letterSpacing: '0.18em',
          textTransform: 'lowercase',
          color: 'rgba(255,255,255,0.2)',
          animation: 'pulse 2s ease-in-out infinite',
        }}>
          tap to continue
        </p>
      )}

      <style>{`
        @keyframes up {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%,100% { opacity:0.2; }
          50%      { opacity:0.5; }
        }
      `}</style>
    </div>
  )
}

// ── Style tokens ──────────────────────────────────────────────────────────────
const styles = {
  eyebrow: {
    fontFamily: 'var(--font-inconsolata)',
    fontSize: 13,
    letterSpacing: '0.2em',
    textTransform: 'lowercase' as const,
    color: 'rgba(255,255,255,0.38)',
    marginBottom: 20,
  },
  headline: {
    fontFamily: 'var(--font-poppins)',
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.02,
    marginBottom: 20,
    letterSpacing: '-0.02em',
  },
  number: {
    fontFamily: 'var(--font-poppins)',
    fontWeight: 700,
    lineHeight: 0.9,
    letterSpacing: '-0.03em',
    marginBottom: 20,
  },
  label: {
    fontFamily: 'var(--font-inconsolata)',
    fontSize: 17,
    letterSpacing: '0.12em',
    textTransform: 'lowercase' as const,
    marginBottom: 18,
  },
  sub: {
    fontFamily: 'var(--font-inconsolata)',
    fontSize: 17,
    color: 'rgba(255,255,255,0.55)',
    maxWidth: 380,
    margin: '0 auto',
    lineHeight: 1.6,
    textTransform: 'lowercase' as const,
  },
  compareBox: {
    flex: 1,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
  },
  compareDivider: {
    width: 1,
    background: 'rgba(255,255,255,0.1)',
    alignSelf: 'stretch' as const,
    margin: '8px 0',
  },
  chip: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '16px 12px',
    textAlign: 'center' as const,
  },
}
