import type { AnalysisStats } from '../types'

interface Props { stats: AnalysisStats | null | undefined }

export default function MarketSentiment({ stats }: Props) {
  const avg = stats?.avg_sentiment ?? 0
  const bullish = stats?.bullish_count ?? 0
  const bearish = stats?.bearish_count ?? 0
  const neutral = stats?.neutral_count ?? 0
  const total = bullish + bearish + neutral || 1

  const label = avg > 10 ? '偏多' : avg < -10 ? '偏空' : '中性'
  const color = avg > 10 ? 'text-teal-500' : avg < -10 ? 'text-rose-500' : 'text-muted'

  return (
    <div className="rounded-2xl border panel p-4">
      <h3 className="text-xs font-semibold text-muted-more uppercase tracking-wide mb-3">市场情绪</h3>
      <div className="flex items-center gap-4 mb-4">
        <div className={`text-3xl font-mono font-bold ${color}`}>
          {avg > 0 ? '+' : ''}{avg.toFixed(1)}
        </div>
        <div>
          <div className={`text-sm font-semibold ${color}`}>{label}</div>
          <div className="text-[10px] text-muted-more">平均情绪指数</div>
        </div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-[#1a2240] mb-2">
        <div className="bg-teal-500 transition-all" style={{ width: `${(bullish / total) * 100}%` }} />
        <div className="bg-slate-300 dark:bg-slate-600 transition-all" style={{ width: `${(neutral / total) * 100}%` }} />
        <div className="bg-rose-500 transition-all" style={{ width: `${(bearish / total) * 100}%` }} />
      </div>
      <div className="flex justify-between text-[10px]">
        <span className="text-teal-500">看多 {bullish}</span>
        <span className="text-muted">中性 {neutral}</span>
        <span className="text-rose-500">看空 {bearish}</span>
      </div>
    </div>
  )
}
