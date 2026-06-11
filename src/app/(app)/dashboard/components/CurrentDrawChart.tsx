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
  currentA: number
}

interface CurrentDrawChartProps {
  data: DataPoint[]
}

/**
 * Recharts area chart showing bunker current draw over the current shift.
 * ReferenceLine at 8 A marks the CURRENT_BUNKER_EMPTY_MAX threshold ("Bunker tom").
 * isAnimationActive={false} prevents re-animation on poll refresh.
 */
export default function CurrentDrawChart({ data }: CurrentDrawChartProps) {
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
            <linearGradient id="currentAGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
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
            domain={[0, 60]}
            unit=" A"
            tick={{ fontSize: 11 }}
            stroke="#a1a1aa"
            width={44}
          />
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(1)} A`, 'Strøm']}
            labelStyle={{ fontSize: 12 }}
            contentStyle={{ fontSize: 12 }}
          />
          <ReferenceLine
            y={8}
            stroke="#f59e0b"
            strokeDasharray="6 3"
            label={{ value: 'Bunker tom', position: 'insideTopRight', fontSize: 11, fill: '#f59e0b' }}
          />
          <Area
            type="monotone"
            dataKey="currentA"
            stroke="#3b82f6"
            fill="url(#currentAGradient)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
