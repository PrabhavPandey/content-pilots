'use client'

import { useState, useEffect } from 'react'

const SLIDES = [
  {
    step: '01',
    title: 'Link click',
    body: 'The user taps your unique tracking link — this is where attribution starts.',
  },
  {
    step: '02',
    title: 'App install',
    body: 'They install TAL on their device and open it for the first time.',
  },
  {
    step: '03',
    title: 'Onboarded',
    body: 'They complete the TAL onboarding flow — profile created, intent verified.',
  },
  {
    step: '04',
    title: 'Qualified city',
    body: "They're based in Bangalore, Mumbai, Delhi, Gurgaon, Hyderabad, or Pune.",
  },
  {
    step: '05',
    title: 'Startup or tech company',
    body: 'They work at a funded startup or product-first tech company - not IT services or outsourcing.',
  },
]

export default function QualificationCarousel() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setActive(prev => (prev + 1) % SLIDES.length)
    }, 3800)
    return () => clearInterval(t)
  }, [])

  const s = SLIDES[active]

  return (
    <div className="border border-gray-100 rounded-lg px-6 py-5 bg-gray-50 mb-8 select-none">
      <p
        className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-4"
        style={{ fontFamily: 'var(--font-inconsolata)' }}
      >
        What counts as a qualified install
      </p>

      <div className="flex items-start gap-4 min-h-[56px]">
        <span
          className="text-xs font-medium text-gray-300 tabular-nums mt-0.5 flex-shrink-0 w-5"
          style={{ fontFamily: 'var(--font-inconsolata)' }}
        >
          {s.step}
        </span>
        <div>
          <p
            className="text-sm font-semibold text-gray-800 leading-tight mb-1"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {s.title}
          </p>
          <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mt-5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === active ? 'w-5 bg-gray-400' : 'w-1.5 bg-gray-200 hover:bg-gray-300'
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
