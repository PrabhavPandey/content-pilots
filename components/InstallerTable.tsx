'use client'

// Admin-only — collapsible installer table with search + sort + detail popover
// Never rendered for pilot (agency) accounts

import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { PilotInstall } from '@/lib/db'

type SortField = 'name' | 'company' | 'city' | 'is_qualified' | 'onboarded_at'
type SortDir   = 'asc' | 'desc'

function QualBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        fontFamily: 'var(--font-inconsolata)',
        background: ok ? '#ECFDF5' : '#FEF2F2',
        color:      ok ? '#059669' : '#DC2626',
      }}
    >
      {ok ? 'Yes' : 'No'}
    </span>
  )
}

function SortIcon({ field, active, dir }: { field: string; active: boolean; dir: SortDir }) {
  return (
    <span className="ml-1 opacity-40 text-[10px]" style={{ opacity: active ? 1 : 0.35 }}>
      {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—'
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return raw
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return raw
  }
}

function DetailPopover({ install, onClose }: { install: PilotInstall; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  const linkedinUrl = install.linkedin
    ? (install.linkedin.startsWith('http') ? install.linkedin : `https://${install.linkedin}`)
    : null

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  const modal = (
    <div
      ref={ref}
      className="rounded-2xl p-7"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: 420,
        background: '#FFFFFF',
        border: '1px solid var(--border)',
        boxShadow: '0 12px 56px rgba(0,0,0,0.16)',
        fontFamily: 'var(--font-inconsolata)',
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors text-[17px] leading-none"
        style={{ color: 'var(--text-muted)' }}
      >
        ×
      </button>

      <div className="mb-5 pr-8">
        <p
          className="text-[19px] font-semibold leading-tight"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-poppins)' }}
        >
          {install.name ?? '—'}
        </p>
        <div className="mt-2">
          <QualBadge ok={install.is_qualified} />
        </div>
      </div>

      <div className="space-y-3.5">
        <PopRow label="Company"      value={install.company ?? '—'} />
        <PopRow label="Role"         value={install.job_role ?? '—'} />
        <PopRow label="City"         value={install.city ?? '—'} />
        <PopRow label="Onboarded"    value={formatDate(install.onboarded_at)} />
        <PopRow label="Phone"        value={install.phone ?? '—'} />
        <PopRow label="City qual"    value={<QualBadge ok={install.is_city_qualified} />} />
        <PopRow label="Company qual" value={<QualBadge ok={install.is_company_qualified} />} />
        {install.gemini_reason && (
          <div className="pt-3 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
            <p
              className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-2"
              style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
            >
              Gemini rationale
            </p>
            <p
              className="text-[13px] leading-relaxed"
              style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-secondary)' }}
            >
              {install.gemini_reason}
            </p>
          </div>
        )}
        {linkedinUrl ? (
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase" style={{ color: 'var(--text-muted)' }}>
              LinkedIn
            </span>
            <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"
              className="text-[13px] text-blue-500 hover:text-blue-700 underline underline-offset-2">
              View profile ↗
            </a>
          </div>
        ) : (
          <PopRow label="LinkedIn" value="—" />
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

function PopRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold tracking-[0.1em] uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-inconsolata)' }}>
        {label}
      </span>
      <span className="text-[13px]" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-inconsolata)' }}>
        {value}
      </span>
    </div>
  )
}

const COLS: { key: SortField; label: string }[] = [
  { key: 'name',         label: 'Name'      },
  { key: 'company',      label: 'Company'   },
  { key: 'city',         label: 'City'      },
  { key: 'is_qualified', label: 'Qualified' },
  { key: 'onboarded_at', label: 'Date'      },
]

export default function InstallerTable({ installs }: { installs: PilotInstall[] }) {
  const [open,      setOpen]      = useState(false)
  const [search,    setSearch]    = useState('')
  const [sortField, setSortField] = useState<SortField>('is_qualified')
  const [sortDir,   setSortDir]   = useState<SortDir>('desc')
  const [selected,  setSelected]  = useState<PilotInstall | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const rows = q
      ? installs.filter(u =>
          [u.name, u.company, u.city, u.phone].some(v => v?.toLowerCase().includes(q))
        )
      : installs

    return [...rows].sort((a, b) => {
      let av: any = a[sortField]
      let bv: any = b[sortField]
      if (typeof av === 'boolean') { av = av ? 1 : 0; bv = bv ? 1 : 0 }
      else { av = (av ?? '').toLowerCase(); bv = (bv ?? '').toLowerCase() }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })
  }, [installs, search, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const qualifiedCount = installs.filter(u => u.is_qualified).length

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors hover:bg-stone-100"
        style={{ background: open ? '#F7F5F2' : '#FAFAF9', border: '1px solid var(--border)', fontFamily: 'var(--font-inconsolata)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--text-secondary)' }}>
            Onboarded Users
          </span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#EFECE8', color: 'var(--text-secondary)' }}>
            {installs.length}
          </span>
          {qualifiedCount > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#ECFDF5', color: '#059669' }}>
              {qualifiedCount} qualified
            </span>
          )}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          className="rounded-b-xl px-4 pb-4 pt-3"
          style={{ border: '1px solid var(--border)', borderTop: 'none', background: '#FAFAF9' }}
        >
          {installs.length === 0 ? (
            <p className="text-[12px] italic py-4 text-center" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-inconsolata)' }}>
              No onboarded users yet for this campaign.
            </p>
          ) : (
            <>
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Search name, company, city..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full text-[12px] px-3 py-2 rounded-lg outline-none"
                  style={{ fontFamily: 'var(--font-inconsolata)', background: '#FFFFFF', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[12px]" style={{ fontFamily: 'var(--font-inconsolata)', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {COLS.map(col => (
                        <th
                          key={col.key}
                          onClick={() => toggleSort(col.key)}
                          className="text-left pb-2 pr-5 cursor-pointer select-none hover:opacity-80 whitespace-nowrap"
                          style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}
                        >
                          {col.label}
                          <SortIcon field={col.key} active={sortField === col.key} dir={sortDir} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-[12px] italic" style={{ color: 'var(--text-muted)' }}>
                          No results for "{search}"
                        </td>
                      </tr>
                    ) : filtered.map(u => (
                      <tr
                        key={u.id}
                        onClick={() => setSelected(u)}
                        className="hover:bg-white transition-colors cursor-pointer"
                        style={{ borderBottom: '1px solid var(--border)' }}
                      >
                        <td className="py-2.5 pr-5 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{u.name ?? '—'}</td>
                        <td className="py-2.5 pr-5" style={{ color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.company ?? undefined}>
                          {u.company ?? '—'}
                        </td>
                        <td className="py-2.5 pr-5 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{u.city ?? '—'}</td>
                        <td className="py-2.5 pr-5"><QualBadge ok={u.is_qualified} /></td>
                        <td className="py-2.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDate(u.onboarded_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {search && (
                <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-inconsolata)' }}>
                  {filtered.length} of {installs.length} users
                </p>
              )}
            </>
          )}
        </div>
      )}

      {selected && <DetailPopover install={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
