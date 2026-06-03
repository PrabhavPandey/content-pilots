'use client'

import { useRouter } from 'next/navigation'
import { useTransition, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = { mode: 'pilots' | 'campaign' }

function LoadingBar({ visible }: { visible: boolean }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: 2,
      zIndex: 9999,
      pointerEvents: 'none',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
    }}>
      <div style={{
        height: '100%',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.7), #fff)',
        backgroundSize: '200% 100%',
        animation: visible ? 'progress-slide 1.4s ease-in-out infinite' : 'none',
        borderRadius: '0 2px 2px 0',
        width: visible ? '85%' : '0%',
        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      }} />
      <style>{`
        @keyframes progress-slide {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>,
    document.body
  )
}

export default function ModeSwitcher({ mode }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const isPilots = mode === 'pilots'

  const go = (target: 'pilots' | 'campaign') => {
    if (target === mode || pending) return
    startTransition(() => {
      router.push(target === 'campaign' ? '/dashboard?mode=campaign' : '/dashboard')
    })
  }

  return (
    <>
      <LoadingBar visible={pending} />

      <div
        role="tablist"
        style={{
          display: 'inline-flex',
          position: 'relative',
          background: '#111',
          borderRadius: 10,
          padding: 3,
          gap: 0,
          opacity: pending ? 0.75 : 1,
          transition: 'opacity 0.2s ease',
        }}
      >
        {/* Sliding pill */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 3,
            bottom: 3,
            borderRadius: 7,
            background: '#fff',
            transition: 'left 0.32s cubic-bezier(0.34, 1.4, 0.64, 1), width 0.32s cubic-bezier(0.34, 1.4, 0.64, 1)',
            left: isPilots ? 3 : 'calc(50% + 1.5px)',
            width: 'calc(50% - 4.5px)',
          }}
        />

        {(['pilots', 'campaign'] as const).map(tab => {
          const isActive = mode === tab
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              onClick={() => go(tab)}
              disabled={pending}
              style={{
                position: 'relative',
                zIndex: 1,
                padding: '6px 18px',
                minWidth: 88,
                border: 'none',
                background: 'transparent',
                cursor: isActive || pending ? 'default' : 'pointer',
                fontFamily: 'var(--font-inconsolata)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: isActive ? '#111' : 'rgba(255,255,255,0.38)',
                transition: 'color 0.28s ease',
                userSelect: 'none',
              }}
            >
              {tab === 'pilots' ? 'Pilots' : 'Campaigns'}
              {pending && isActive && (
                <span style={{
                  display: 'inline-block',
                  marginLeft: 6,
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: '#111',
                  verticalAlign: 'middle',
                  animation: 'dot-pulse 0.8s ease-in-out infinite',
                }} />
              )}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes dot-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </>
  )
}
