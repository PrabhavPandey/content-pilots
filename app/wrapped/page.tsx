'use client'

import { useState, useEffect, useCallback } from 'react'

// ── UGC campaign stats — update after each sync ───────────────────────────────
const SLIDES = [
  {
    type: 'title' as const,
    eyebrow: 'TAL · UGC Pilots',
    headline: 'May 2026',
    sub: 'Aarchi & Third Draft Films',
  },
  {
    type: 'stat' as const,
    value: '120',
    label: 'videos created',
    sub: 'across 2 agencies',
  },
  {
    type: 'stat' as const,
    value: '11.9M',
    label: 'views generated',
    sub: 'fully organic, no paid amplification',
  },
  {
    type: 'stat' as const,
    value: '5,959',
    label: 'app installs',
    sub: 'directly attributed to content',
  },
  {
    type: 'stat' as const,
    value: '4,221',
    label: 'people onboarded',
    sub: '70.8% of installs signed up on TAL',
  },
  {
    type: 'stat' as const,
    value: '789',
    label: 'qualified professionals',
    sub: 'SWEs, PMs, designers — your ICP',
    accent: true,
  },
  {
    type: 'stat' as const,
    value: '₹44',
    label: 'cost per install',
    sub: 'fully attributed to content spend',
  },
  {
    type: 'stat' as const,
    value: '₹22',
    label: 'cost per 1,000 views',
    sub: 'blended CPM across both pilots',
  },
  {
    type: 'end' as const,
    headline: 'Content works.',
    sub: 'Day 26 · still running.',
  },
]

export default function WrappedPage() {
  const [idx, setIdx] = useState(0)
  const [animKey, setAnimKey] = useState(0)

  const advance = useCallback(() => {
    if (idx < SLIDES.length - 1) {
      setIdx(i => i + 1)
      setAnimKey(k => k + 1)
    }
  }, [idx])

  const back = useCallback(() => {
    if (idx > 0) {
      setIdx(i => i - 1)
      setAnimKey(k => k + 1)
    }
  }, [idx])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') advance()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [advance, back])

  const slide = SLIDES[idx]
  const isLast = idx === SLIDES.length - 1

  return (
    <div
      onClick={advance}
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
        padding: '40px 24px',
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            height: '100%',
            background: slide.type === 'stat' && slide.accent ? '#16A34A' : '#fff',
            width: `${((idx + 1) / SLIDES.length) * 100}%`,
            transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>

      {/* Slide dots */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {SLIDES.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === idx ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === idx
                ? (slide.type === 'stat' && slide.accent ? '#16A34A' : '#fff')
                : 'rgba(255,255,255,0.18)',
              transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div
        key={animKey}
        style={{
          textAlign: 'center',
          maxWidth: 560,
          animation: 'slideUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        {slide.type === 'title' && (
          <>
            <p
              style={{
                fontFamily: 'var(--font-inconsolata)',
                fontSize: 13,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: 28,
              }}
            >
              {slide.eyebrow}
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-poppins)',
                fontSize: 'clamp(52px, 12vw, 96px)',
                fontWeight: 700,
                color: '#fff',
                lineHeight: 1,
                marginBottom: 24,
              }}
            >
              {slide.headline}
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-inconsolata)',
                fontSize: 16,
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              {slide.sub}
            </p>
          </>
        )}

        {slide.type === 'stat' && (
          <>
            <p
              style={{
                fontFamily: 'var(--font-inconsolata)',
                fontSize: 12,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: slide.accent ? 'rgba(74,222,128,0.6)' : 'rgba(255,255,255,0.35)',
                marginBottom: 20,
              }}
            >
              {slide.label}
            </p>
            <div
              style={{
                fontFamily: 'var(--font-poppins)',
                fontSize: 'clamp(72px, 18vw, 144px)',
                fontWeight: 700,
                lineHeight: 0.9,
                color: slide.accent ? '#4ADE80' : '#fff',
                marginBottom: 28,
                letterSpacing: '-0.02em',
              }}
            >
              {slide.value}
            </div>
            {slide.sub && (
              <p
                style={{
                  fontFamily: 'var(--font-inconsolata)',
                  fontSize: 15,
                  color: 'rgba(255,255,255,0.3)',
                  maxWidth: 320,
                  margin: '0 auto',
                  lineHeight: 1.5,
                }}
              >
                {slide.sub}
              </p>
            )}
          </>
        )}

        {slide.type === 'end' && (
          <>
            <p
              style={{
                fontFamily: 'var(--font-inconsolata)',
                fontSize: 12,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'rgba(74,222,128,0.6)',
                marginBottom: 28,
              }}
            >
              TAL · UGC Pilots
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-poppins)',
                fontSize: 'clamp(48px, 11vw, 88px)',
                fontWeight: 700,
                color: '#fff',
                lineHeight: 1.05,
                marginBottom: 24,
              }}
            >
              {slide.headline}
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-inconsolata)',
                fontSize: 15,
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              {slide.sub}
            </p>
            {/* Mini summary grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                marginTop: 56,
              }}
            >
              {[
                { v: '11.9M', l: 'Views' },
                { v: '5,959', l: 'Installs' },
                { v: '789', l: 'Qualified' },
                { v: '₹22', l: 'CPM' },
                { v: '₹44', l: 'Cost / install' },
                { v: '120', l: 'Videos' },
              ].map(({ v, l }) => (
                <div
                  key={l}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 12,
                    padding: '14px 12px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-poppins)',
                      fontSize: 22,
                      fontWeight: 700,
                      color: '#fff',
                      marginBottom: 4,
                    }}
                  >
                    {v}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-inconsolata)',
                      fontSize: 10,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {l}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Tap hint */}
      {!isLast && (
        <p
          style={{
            position: 'absolute',
            bottom: 28,
            fontFamily: 'var(--font-inconsolata)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.2)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          tap to continue
        </p>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.2; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
