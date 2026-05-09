// Admin-only — shows onboarded users from a campaign with qualification details
// Never rendered for pilot (agency) accounts

import { PilotInstall } from '@/lib/db'

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

export default function InstallerTable({ installs }: { installs: PilotInstall[] }) {
  if (installs.length === 0) {
    return (
      <p
        className="text-[12px] italic mt-3 mb-1"
        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-inconsolata)' }}
      >
        No onboarded users yet for this campaign.
      </p>
    )
  }

  return (
    <div
      className="mt-6 pt-6 overflow-x-auto"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <p
        className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-3"
        style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
      >
        Onboarded Users ({installs.length})
      </p>

      <table className="w-full text-[12px]" style={{ fontFamily: 'var(--font-inconsolata)', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Name', 'Company', 'City', 'Phone', 'Qualified', 'LinkedIn'].map(h => (
              <th
                key={h}
                className="text-left pb-2 pr-4 font-semibold tracking-[0.1em] uppercase text-[10px]"
                style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {installs.map((u) => (
            <tr
              key={u.id}
              style={{ borderBottom: '1px solid var(--border)' }}
              className="hover:bg-stone-50 transition-colors"
            >
              <td className="py-2.5 pr-4" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {u.name ?? '—'}
              </td>
              <td className="py-2.5 pr-4" style={{ color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.company ?? '—'}
              </td>
              <td className="py-2.5 pr-4" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {u.city ?? '—'}
              </td>
              <td className="py-2.5 pr-4" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {u.phone ? `•••• ${u.phone.slice(-4)}` : '—'}
              </td>
              <td className="py-2.5 pr-4">
                <QualBadge ok={u.is_qualified} />
              </td>
              <td className="py-2.5">
                {u.linkedin ? (
                  <a
                    href={u.linkedin.startsWith('http') ? u.linkedin : `https://${u.linkedin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 underline underline-offset-2"
                  >
                    View
                  </a>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
