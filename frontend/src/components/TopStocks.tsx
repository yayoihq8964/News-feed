import { useMemo } from 'react'
import type { Analysis } from '../types'

interface Props { analyses: Analysis[] }

export default function TopStocks({ analyses }: Props) {
  const top = useMemo(() => {
    const map: Record<string, { total: number; count: number; company: string }> = {}
    for (const a of analyses) {
      for (const s of a.affected_stocks ?? []) {
        if (!map[s.ticker]) map[s.ticker] = { total: 0, count: 0, company: s.company }
        map[s.ticker].total += s.impact_score
        map[s.ticker].count += 1
      }
    }
    return Object.entries(map)
      .map(([ticker, v]) => ({ ticker, avg: Math.round(v.total / v.count), count: v.count, company: v.company }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [analyses])

  if (top.length === 0) return null
  const maxAbs = Math.max(...top.map(s => Math.abs(s.avg)), 1)

  return (
    <div className="rounded-xl border panel p-4">
      <h3 className="text-xs font-semibold text-muted-more uppercase tracking-wide mb-3">热门影响股票</h3>
      <div className="space-y-2">
        {top.map(s => (
          <div key={s.ticker} className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold w-12">{s.ticker}</span>
            <div className="flex-1 flex items-center h-4">
              {s.avg >= 0 ? (
                <><div className="w-1/2" /><div className="w-1/2 flex items-center">
                  <div className="h-1.5 rounded-r bg-emerald-500 transition-all" style={{ width: `${(s.avg / maxAbs) * 100}%` }} />
                </div></>
              ) : (
                <><div className="w-1/2 flex items-center justify-end">
                  <div className="h-1.5 rounded-l bg-red-500 transition-all" style={{ width: `${(Math.abs(s.avg) / maxAbs) * 100}%` }} />
                </div><div className="w-1/2" /></>
              )}
            </div>
            <span className={`font-mono text-[10px] font-semibold w-8 text-right ${s.avg >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {s.avg > 0 ? '+' : ''}{s.avg}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
