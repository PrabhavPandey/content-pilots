'use client'

import { useState, useEffect } from 'react'
import { MetricsWithPilot, PilotInstall } from '@/lib/db'
import { getPilotMeta } from '@/lib/pilot-config'
import PilotCard from './PilotCard'
import InstallerTable from './InstallerTable'
import CumulativeSummary from './CumulativeSummary'

type Props = {
  metrics: MetricsWithPilot[]
  installsMap: Map<string, PilotInstall[]>
}

function ToggleSwitch({ on }: { on: boolean }) {
  return (
    <div
      className="relative rounded-full transition-colors duration-200 shrink-0"
      style={{
        width: 30,
        height: 17,
        background: on ? '#1A1A1A' : '#C8C2BB',
      }}
    >
      <div
        className="absolute top-[2px] rounded-full transition-transform duration-200"
        style={{
          width: 13,
          height: 13,
          background: '#fff',
          left: 2,
          transform: on ? 'translateX(13px)' : 'translateX(0)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
        }}
      />
    </div>
  )
}

export default function DashboardAdminView({ metrics, installsMap }: Props) {
  const [hideFinancials, setHideFinancials] = useState(false)

  useEffect(() => {
    setHideFinancials(localStorage.getItem('hideFinancials') === '1')
  }, [])

  const toggle = () =>
    setHideFinancials(h => {
      const next = !h
      localStorage.setItem('hideFinancials', next ? '1' : '0')
      return next
    })

  const influencers = metrics.filter(m => m.pilot.type === 'influencer')
  const ugc         = metrics.filter(m => m.pilot.type === 'ugc')

  return (
    <div className="space-y-10">
      {/* Hide financials toggle */}
      <div className="flex justify-end -mt-6">
        <button
          onClick={toggle}
          className="flex items-center gap-2"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span
            className="text-[11px] font-semibold tracking-[0.1em] uppercase"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            Hide financials
          </span>
          <ToggleSwitch on={hideFinancials} />
        </button>
      </div>

      <CumulativeSummary
        metrics={metrics}
        installsMap={installsMap}
        hideFinancials={hideFinancials}
      />

      {influencers.length > 0 && (
        <section>
          <p
            className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-4"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            Influencer
          </p>
          <div className="flex flex-col gap-4">
            {influencers.map((m, i) => {
              const meta = getPilotMeta(m.pilot.linkrunner_campaign_name)
              const pilotInstalls = installsMap.get(m.pilot_id) ?? []
              return (
                <div key={m.pilot_id}>
                  <PilotCard
                    metrics={m}
                    isAdmin
                    budget={meta?.budget}
                    videoCount={meta?.videoCount}
                    views={meta?.views}
                    index={i}
                    hideFinancials={hideFinancials}
                    installs={pilotInstalls}
                  />
                  <InstallerTable installs={pilotInstalls} />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {ugc.length > 0 && (
        <section>
          <p
            className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-4"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            UGC
          </p>
          <div className="flex flex-col gap-4">
            {ugc.map((m, i) => {
              const meta = getPilotMeta(m.pilot.linkrunner_campaign_name)
              const pilotInstalls = installsMap.get(m.pilot_id) ?? []
              return (
                <div key={m.pilot_id}>
                  <PilotCard
                    metrics={m}
                    isAdmin
                    budget={meta?.budget}
                    videoCount={meta?.videoCount}
                    views={meta?.views}
                    index={i}
                    hideFinancials={hideFinancials}
                    installs={pilotInstalls}
                  />
                  <InstallerTable installs={pilotInstalls} />
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
