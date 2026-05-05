'use client'

import { useState } from 'react'

export default function CopyLinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  // Strip https:// for display
  const display = url.replace('https://', '')

  return (
    <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
      <p
        className="text-[10px] font-semibold tracking-[0.18em] uppercase mb-2"
        style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
      >
        Your tracking link
      </p>

      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{
          background: '#F7F5F2',
          border: '1px solid var(--border)',
        }}
      >
        <span
          className="flex-1 text-[13px] font-medium truncate"
          style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-primary)' }}
        >
          {display}
        </span>
        <button
          onClick={copy}
          className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer"
          style={{
            fontFamily: 'var(--font-inconsolata)',
            background: copied ? '#ECFDF5' : '#FFFFFF',
            color: copied ? '#059669' : '#52525B',
            border: copied ? '1px solid #A7F3D0' : '1px solid #E4E4E7',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <p
        className="text-[11px] mt-1.5 leading-relaxed"
        style={{ color: 'var(--text-muted)' }}
      >
        Drop this in your bio, link-in-bio tool, or DM/comment automation. Every tap is attributed to you.
      </p>
    </div>
  )
}
