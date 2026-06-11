'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DataPoint {
  name: string
  count: number
}

interface ProduksjonIDagChartProps {
  data: DataPoint[]
}

/**
 * Recharts bar chart showing bales produced today per fraction.
 * isAnimationActive={false} prevents re-animation flicker on poll refresh.
 */
export default function ProduksjonIDagChart({ data }: ProduksjonIDagChartProps) {
  const hasData = data.length > 0 && data.some((d) => d.count > 0)

  if (!hasData) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
        Ingen produksjon i dag
      </div>
    )
  }

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            stroke="#a1a1aa"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#a1a1aa"
            width={36}
          />
          <Tooltip
            formatter={(v) => [Number(v), 'Baler']}
            labelStyle={{ fontSize: 12 }}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar
            dataKey="count"
            fill="#3b82f6"
            isAnimationActive={false}
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
