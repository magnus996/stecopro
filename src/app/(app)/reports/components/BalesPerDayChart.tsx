'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// Stable colors per fraction name; fallback for unknowns
const FRACTION_COLORS: Record<string, string> = {
  'Deink': '#3b82f6',
  'Tetra/emballasjepapp': '#10b981',
  'OCC': '#f59e0b',
  'Miks': '#6b7280',
}

interface BalesPerDayChartProps {
  /** Wide format: each entry is one day; fraction-name keys hold bale count. */
  data: Record<string, number | string>[]
  /** Ordered fraction names — determines stack order and color assignment. */
  fractions: string[]
}

/**
 * Recharts stacked BarChart showing bales per fraction per Oslo calendar day.
 * All bars share stackId="a" so they stack.
 * isAnimationActive={false} prevents re-animation on refresh.
 */
export function BalesPerDayChart({ data, fractions }: BalesPerDayChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
        Ingen baledata i perioden
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            stroke="#a1a1aa"
          />
          <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" />
          <Tooltip
            labelStyle={{ fontSize: 12 }}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {fractions.map((f) => (
            <Bar
              key={f}
              dataKey={f}
              stackId="a"
              fill={FRACTION_COLORS[f] ?? '#8884d8'}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
