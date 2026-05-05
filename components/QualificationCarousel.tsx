'use client'

import { useState, useEffect } from 'react'

const SLIDES = [
  {
    step: '01',
    title: 'Link tap',
    body: 'User taps your unique tracking link. Attribution starts the moment they click.',
  },
  {
    step: '02',
    title: 'App install',
    body: 'They install TAL on their device and open it for the first time.',
  },
  {
    step: '03',
    title: 'Onboarded',
    body: 'They complete the TAL onboarding — profile created, intent verified.',
  },
  {
    step: '04',
    title: 'Right city',
    body: 'They\'re based in Bangalore, Mumbai, Delhi, Gurgaon, Hyderabad, or Pune.',
  },
  {
    step: '05',
    title: 'Right company',
    body: 'They work at a funded startup or product-first tech company — not IT services.',
  },
]

export default function QualificationCarousel() {
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(true)

  function goTo(i: number) {
    setVisible(false)
    setTimeout(() => {
      setActive(i)
      setVisible(true)
    }, 180)
  }

  useEffect(() => {
    const t = setInterval(() => {
      goTo((active + 1) % SLIDES.length)
    }, 4200)
    return () => clearInterval(t)
  }, [active])

  const s = SLIDES[active]

  return (
    <div
      className="rounded-2xl px-6 py-5 mb-8 select-none"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Label + dots */}
      <div className="flex items-center justify-between mb-4">
        <p
          className="text-[10px] font-semibold tracking-[0.2em] uppercase"
          style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
        >
          What counts as qualified
        </p>
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                i === active ? 'w-5 bg-zinc-400' : 'w-1.5 bg-zinc-200 hover:bg-zinc-300'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Slide content */}
      <div
        className="flex items-start gap-4 min-h-[52px] transition-opacity duration-180"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <span
          className="text-[11px] font-medium tabular-nums flex-shrink-0 mt-0.5 w-5"
          style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
        >
          {s.step}
        </span>
        <div>
          <p
            className="text-sm font-semibold leading-tight mb-1"
            style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}
          >
            {s.title}
          </p>
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {s.body}
          </p>
        </div>
      </div>
    </div>
  )
}
