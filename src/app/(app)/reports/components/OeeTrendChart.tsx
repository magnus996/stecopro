'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface OeeTrendPoint {
  label: string
  oeePct: number
  shiftType: string
}

interface OeeTrendChartProps {
  data: OeeTrendPoint[]
}

/**
 * Recharts LineChart showing OEE % per shift over the selected period.
 * X axis = shift label ('dd.MM Dag' / 'dd.MM Kveld'), Y axis = 0–100 %.
 * Day vs evening is distinguishable via the label text.
 * isAnimationActive={false} prevents re-animation on refresh.
 */
export function OeeTrendChart({ data }: OeeTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
        Ingen skiftdata i perioden
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={60}
            stroke="#a1a1aa"
          />
          <YAxis
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 11 }}
            stroke="#a1a1aa"
            width={44}
          />
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(1)} %`, 'OEE']}
            labelStyle={{ fontSize: 12 }}
            contentStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="oeePct"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#3b82f6' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
