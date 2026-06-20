'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

interface DataPoint {
  label: string
  coveragePct: number
}

interface BeltUtilizationChartProps {
  data: DataPoint[]
  /** Saturation reference line (percent). Defaults to 100 % ("Metning"). */
  target?: number
}

/**
 * Recharts area chart showing optical sorter (Tomra) utilisation over a shift.
 * coveragePct = normalised utilisation 0-120 %; the Tomra is the line bottleneck so
 * normal running sits at saturation (~100 %) and only dips when the bunker runs empty.
 * ReferenceLine marks saturation ("Metning"). isAnimationActive={false} avoids re-animation on poll refresh.
 */
export default function BeltUtilizationChart({ data, target = 100 }: BeltUtilizationChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
        Ingen måledata
      </div>
    )
  }

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="coverageGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            stroke="#a1a1aa"
          />
          <YAxis
            domain={[0, 120]}
            unit=" %"
            tick={{ fontSize: 11 }}
            stroke="#a1a1aa"
            width={48}
          />
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(0)} %`, 'Utnyttelse']}
            labelStyle={{ fontSize: 12 }}
            contentStyle={{ fontSize: 12 }}
          />
          <ReferenceLine
            y={target}
            stroke="#f59e0b"
            strokeDasharray="6 3"
            label={{ value: `Metning ${target} %`, position: 'insideBottomRight', fontSize: 11, fill: '#f59e0b' }}
          />
          <Area
            type="monotone"
            dataKey="coveragePct"
            stroke="#10b981"
            fill="url(#coverageGradient)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
