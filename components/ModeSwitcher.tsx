'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

type Props = { mode: 'pilots' | 'campaign' }

export default function ModeSwitcher({ mode }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const go = (target: 'pilots' | 'campaign') => {
    if (target === mode) return
    startTransition(() => {
      router.push(target === 'campaign' ? '/dashboard?mode=campaign' : '/dashboard')
    })
  }

  const isPilots   = mode === 'pilots'
  const isCampaign = mode === 'campaign'

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Spinning aurora ring — always present, follows active tab */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: -2,
          borderRadius: 14,
          zIndex: 0,
          overflow: 'hidden',
          opacity: pending ? 0.5 : 1,
          transition: 'opacity 0.3s ease',
        }}
      >
        <div style={{
          position: 'absolute',
          inset: -20,
          background: 'conic-gradient(from 0deg, #22D3EE, #A78BFA, #4ADE80, #F59E0B, #22D3EE)',
          animation: 'aurora-spin 3s linear infinite',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute',
          inset: 2,
          background: '#0D0D0D',
          borderRadius: 12,
        }} />
      </div>

      {/* Pill container */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          background: '#111',
          borderRadius: 12,
          padding: 3,
          gap: 0,
        }}
      >
        {/* Sliding active indicator */}
        <div
          style={{
            position: 'absolute',
            top: 3,
            bottom: 3,
            width: 'calc(50% - 3px)',
            borderRadius: 9,
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            transform: isPilots ? 'translateX(0)' : 'translateX(calc(100% + 0px))',
            transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
            left: 3,
          }}
        />

        {(['pilots', 'campaign'] as const).map(tab => {
          const isActive = mode === tab
          return (
            <button
              key={tab}
              onClick={() => go(tab)}
              disabled={pending}
              style={{
                position: 'relative',
                zIndex: 1,
                padding: '6px 16px',
                borderRadius: 9,
                border: 'none',
                background: 'transparent',
                cursor: isActive ? 'default' : 'pointer',
                fontFamily: 'var(--font-inconsolata)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'color 0.25s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {tab === 'pilots' ? 'Pilots' : 'Campaigns'}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes aurora-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
