import { useMemo } from 'react'
import type { Analysis } from '../types'

interface Props { analyses: Analysis[] }
const ICONS: Record<string, string> = { Gold: '🥇', Silver: '🥈', Platinum: '💎', Palladium: '⚪' }

export default function CommodityPanel({ analyses }: Props) {
  const agg = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    for (const a of analyses) {
      for (const c of a.affected_commodities ?? []) {
        if (!map[c.name]) map[c.name] = { total: 0, count: 0 }
        map[c.name].total += c.impact_score
        map[c.name].count += 1
      }
    }
    return Object.entries(map).map(([name, v]) => ({
      name, avg: Math.round(v.total / v.count), count: v.count,
    })).sort((a, b) => b.count - a.count).slice(0, 6)
  }, [analyses])

  return (
    <div className="rounded-[2rem] panel p-6 bio-card">
      <h3 className="text-xs font-semibold text-muted-more uppercase tracking-wide mb-3">贵金属影响</h3>
      {agg.length === 0 ? (
        <p className="text-xs text-muted text-center py-4">暂无数据</p>
      ) : (
        <div className="space-y-2.5">
          {agg.map(c => (
            <div key={c.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{ICONS[c.name] ?? '🔘'}</span>
                <span className="text-sm">{c.name}</span>
                <span className="text-[10px] text-muted-more">({c.count}条)</span>
              </div>
              <span className={`font-mono text-sm font-bold ${c.avg > 0 ? 'text-leaf-600 dark:text-leaf-400' : c.avg < 0 ? 'text-coral-500 dark:text-coral-400' : 'text-muted'}`}>
                {c.avg > 0 ? '+' : ''}{c.avg}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
