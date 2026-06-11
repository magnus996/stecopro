'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface ParetoPoint {
  reason: string
  minutes: number
  incidentCount: number
  cumPct: number
}

interface ParetoChartProps {
  data: ParetoPoint[]
}

/**
 * Recharts ComposedChart Pareto: bars = total stop minutes (left Y axis),
 * line = cumulative % (right Y axis, 0–100%).
 * Data sorted descending by duration — passed in already sorted from the page.
 * Tooltip shows both minutes and incidentCount (RPRT-02: duration + count).
 * isAnimationActive={false} prevents re-animation on refresh.
 */
export function ParetoChart({ data }: ParetoChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
        Ingen stoppdata i perioden
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 40, left: 0, bottom: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="reason"
            tick={{ fontSize: 10 }}
            angle={-35}
            textAnchor="end"
            interval={0}
            stroke="#a1a1aa"
          />
          <YAxis
            yAxisId="left"
            unit=" min"
            tick={{ fontSize: 11 }}
            stroke="#a1a1aa"
            width={52}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 11 }}
            stroke="#a1a1aa"
            width={40}
          />
          <Tooltip
            formatter={(v, name) => {
              if (name === 'minutes') return [`${Number(v)} min`, 'Stoppetid']
              if (name === 'cumPct') return [`${Number(v)} %`, 'Kumulativ %']
              if (name === 'incidentCount') return [String(v), 'Antall hendelser']
              return [String(v), String(name)]
            }}
            labelStyle={{ fontSize: 12 }}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar
            yAxisId="left"
            dataKey="minutes"
            fill="#3b82f6"
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumPct"
            stroke="#f59e0b"
            dot={{ r: 3, fill: '#f59e0b' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
