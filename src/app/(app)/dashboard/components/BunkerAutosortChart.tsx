'use client'

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

interface DataPoint {
  label: string
  currentA: number | null
  coveragePct: number | null
}

interface BunkerAutosortChartProps {
  data: DataPoint[]
  /** Saturation reference line for utilisation (percent). Defaults to 100 %. */
  saturation?: number
}

/**
 * Combined dashboard trend: dosing-bunker current draw (A, left axis, blue area)
 * and Tomra Autosort utilisation (%, right axis, green line) on a shared time base.
 *
 * The Tomra is the line bottleneck, so utilisation normally sits at saturation
 * (~100 %) and dips only when the bunker runs empty — visible alongside the bunker
 * current dropping into its "empty" band at the same moments.
 * isAnimationActive={false} prevents re-animation on poll refresh.
 */
export default function BunkerAutosortChart({ data, saturation = 100 }: BunkerAutosortChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
        Ingen måledata
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bunkerCurrentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
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
          {/* Left axis: bunker current draw (A) */}
          <YAxis
            yAxisId="current"
            domain={[0, 20]}
            unit=" A"
            tick={{ fontSize: 11 }}
            stroke="#3b82f6"
            width={44}
          />
          {/* Right axis: Autosort utilisation (%) */}
          <YAxis
            yAxisId="util"
            orientation="right"
            domain={[0, 120]}
            unit=" %"
            tick={{ fontSize: 11 }}
            stroke="#10b981"
            width={48}
          />
          <Tooltip
            formatter={(v, name) =>
              name === 'Strøm (bunker)'
                ? [`${Number(v).toFixed(1)} A`, name]
                : [`${Number(v).toFixed(0)} %`, name]
            }
            labelStyle={{ fontSize: 12 }}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {/* Bunker-empty current threshold (left axis) */}
          <ReferenceLine
            yAxisId="current"
            y={8}
            stroke="#f59e0b"
            strokeDasharray="6 3"
            label={{ value: 'Bunker tom', position: 'insideTopLeft', fontSize: 10, fill: '#f59e0b' }}
          />
          {/* Saturation reference (right axis) */}
          <ReferenceLine
            yAxisId="util"
            y={saturation}
            stroke="#10b981"
            strokeDasharray="6 3"
            label={{ value: `Metning ${saturation} %`, position: 'insideBottomRight', fontSize: 10, fill: '#10b981' }}
          />
          <Area
            yAxisId="current"
            type="monotone"
            dataKey="currentA"
            name="Strøm (bunker)"
            stroke="#3b82f6"
            fill="url(#bunkerCurrentGradient)"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            yAxisId="util"
            type="monotone"
            dataKey="coveragePct"
            name="Utnyttelse (Autosort)"
            stroke="#10b981"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
