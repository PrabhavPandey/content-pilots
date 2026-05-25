'use client'

import { useState, useRef, useCallback, useId } from 'react'
import type { PilotInstall } from '@/lib/db'

type DataPoint = { date: string; total: number; qualified: number }

function buildData(installs: PilotInstall[]): DataPoint[] {
  const byDate = new Map<string, { total: number; qualified: number }>()
  for (const inst of installs) {
    if (!inst.onboarded_at) continue
    const date = inst.onboarded_at.slice(0, 10)
    const existing = byDate.get(date) ?? { total: 0, qualified: 0 }
    existing.total++
    if (inst.is_qualified) existing.qualified++
    byDate.set(date, existing)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }))
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Catmull-Rom → cubic bezier smooth path
function smoothPath(points: [number, number][]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`

  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6

    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0]},${p2[1]}`
  }
  return d
}

const PAD = { top: 16, right: 12, bottom: 30, left: 32 }
const SVG_W = 500
const SVG_H = 150
const PLOT_W = SVG_W - PAD.left - PAD.right
const PLOT_H = SVG_H - PAD.top - PAD.bottom

export default function InstallsChart({ installs }: { installs: PilotInstall[] }) {
  const uid = useId().replace(/:/g, '')
  const data = buildData(installs)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  if (data.length < 2) return null

  const maxVal = Math.max(...data.map(d => d.total), 1)

  const xScale = (i: number) => PAD.left + (i / (data.length - 1)) * PLOT_W
  const yScale = (v: number) => PAD.top + PLOT_H - (v / maxVal) * PLOT_H

  const totalPts: [number, number][] = data.map((d, i) => [xScale(i), yScale(d.total)])
  const qualPts:  [number, number][] = data.map((d, i) => [xScale(i), yScale(d.qualified)])

  const totalPath = smoothPath(totalPts)
  const qualPath  = smoothPath(qualPts)

  const baseY     = PAD.top + PLOT_H
  const totalArea = totalPath + ` L ${totalPts.at(-1)![0]},${baseY} L ${PAD.left},${baseY} Z`
  const qualArea  = qualPath  + ` L ${qualPts.at(-1)![0]},${baseY}  L ${PAD.left},${baseY} Z`

  // Y-axis: 4 ticks
  const yTickCount = 4
  const yTicks = Array.from({ length: yTickCount }, (_, i) =>
    Math.round((i / (yTickCount - 1)) * maxVal)
  )

  // X-axis: ~5 evenly spaced labels
  const xLabelCount = Math.min(5, data.length)
  const xLabelIndices = Array.from({ length: xLabelCount }, (_, i) =>
    Math.round((i / (xLabelCount - 1)) * (data.length - 1))
  )

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (SVG_W / rect.width)
    const raw = ((x - PAD.left) / PLOT_W) * (data.length - 1)
    setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round(raw))))
  }, [data.length])

  const hoverPt = hoverIdx !== null ? data[hoverIdx] : null
  const hoverX  = hoverIdx !== null ? xScale(hoverIdx) : null

  const gradTotalId = `gradTotal-${uid}`
  const gradQualId  = `gradQual-${uid}`

  return (
    <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-semibold tracking-[0.18em] uppercase"
          style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
        >
          Daily growth
        </span>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <svg width="16" height="2" viewBox="0 0 16 2" fill="none">
              <line x1="0" y1="1" x2="16" y2="1" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span
              className="text-[10px] font-medium"
              style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-secondary)' }}
            >
              Onboarded
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="16" height="2" viewBox="0 0 16 2" fill="none">
              <line x1="0" y1="1" x2="16" y2="1" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span
              className="text-[10px] font-medium"
              style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-secondary)' }}
            >
              Qualified
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full"
          style={{ height: SVG_H, overflow: 'visible', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={gradTotalId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#1A1A1A" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#1A1A1A" stopOpacity="0"    />
            </linearGradient>
            <linearGradient id={gradQualId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#16A34A" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#16A34A" stopOpacity="0"    />
            </linearGradient>
          </defs>

          {/* Gridlines + Y-axis labels */}
          {yTicks.map(tick => {
            const y = yScale(tick)
            return (
              <g key={tick}>
                <line
                  x1={PAD.left} y1={y} x2={SVG_W - PAD.right} y2={y}
                  stroke="#EFECE8" strokeWidth="1"
                />
                <text
                  x={PAD.left - 7}
                  y={y + 3.5}
                  textAnchor="end"
                  style={{ fontSize: 9, fill: '#B8B0A8', fontFamily: 'var(--font-inconsolata)' }}
                >
                  {tick}
                </text>
              </g>
            )
          })}

          {/* X-axis labels */}
          {xLabelIndices.map(idx => (
            <text
              key={idx}
              x={xScale(idx)}
              y={SVG_H - 2}
              textAnchor="middle"
              style={{ fontSize: 9, fill: '#B8B0A8', fontFamily: 'var(--font-inconsolata)' }}
            >
              {formatDate(data[idx].date)}
            </text>
          ))}

          {/* Area fills */}
          <path d={totalArea} fill={`url(#${gradTotalId})`} />
          <path d={qualArea}  fill={`url(#${gradQualId})`}  />

          {/* Lines */}
          <path
            d={totalPath}
            fill="none"
            stroke="#1A1A1A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={qualPath}
            fill="none"
            stroke="#16A34A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hover crosshair + dots */}
          {hoverIdx !== null && hoverX !== null && (
            <>
              <line
                x1={hoverX} y1={PAD.top - 4}
                x2={hoverX} y2={PAD.top + PLOT_H}
                stroke="#C8C2BB" strokeWidth="1" strokeDasharray="3,3"
              />
              {/* Total dot */}
              <circle
                cx={hoverX} cy={yScale(data[hoverIdx].total)}
                r="4.5" fill="white" stroke="#1A1A1A" strokeWidth="2"
              />
              {/* Qualified dot */}
              <circle
                cx={hoverX} cy={yScale(data[hoverIdx].qualified)}
                r="4.5" fill="white" stroke="#16A34A" strokeWidth="2"
              />
            </>
          )}
        </svg>

        {/* Floating tooltip */}
        {hoverPt && (
          <div
            className="flex items-center justify-between mt-2 px-3 py-2 rounded-xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <span
              className="text-[11px] font-semibold"
              style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
            >
              {formatDate(hoverPt.date)}
            </span>
            <div className="flex items-center gap-5">
              <span
                className="text-[11px] font-semibold tabular-nums"
                style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-primary)' }}
              >
                {hoverPt.total} onboarded
              </span>
              <span
                className="text-[11px] font-semibold tabular-nums"
                style={{ fontFamily: 'var(--font-inconsolata)', color: '#16A34A' }}
              >
                {hoverPt.qualified} qualified
              </span>
            </div>
          </div>
        )}

        {/* Spacer when not hovering to prevent layout shift */}
        {!hoverPt && (
          <div className="mt-2" style={{ height: 38 }} />
        )}
      </div>
    </div>
  )
}
