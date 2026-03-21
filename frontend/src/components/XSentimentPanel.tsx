import type { XSentiment } from '../types'

interface Props { data: XSentiment | null | undefined; loading: boolean; onRefresh: () => void }

export default function XSentimentPanel({ data, loading, onRefresh }: Props) {
  const tickers = data?.trending_tickers ?? []
  const fg = data?.fear_greed_estimate ?? 50
  const fgLabel = fg >= 75 ? '极度贪婪' : fg >= 55 ? '贪婪' : fg >= 45 ? '中性' : fg >= 25 ? '恐惧' : '极度恐惧'
  const fgColor = fg >= 75 ? 'text-emerald-500' : fg >= 55 ? 'text-lime-500' : fg >= 45 ? 'text-muted' : fg >= 25 ? 'text-orange-500' : 'text-rose-500'

  return (
    <div className="rounded-2xl panel p-5 hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-more uppercase tracking-wide">X / 推特情绪</h3>
        <button onClick={onRefresh} disabled={loading}
          className="text-[10px] text-indigo-500 hover:text-indigo-600 disabled:text-slate-400 transition-colors duration-200">
          {loading ? '加载中...' : '刷新'}
        </button>
      </div>
      {!data ? <p className="text-xs text-muted text-center py-4">暂无数据，点击刷新获取</p> : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">恐惧/贪婪指数</span>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-lg font-bold ${fgColor}`}>{fg}</span>
              <span className={`text-[10px] ${fgColor}`}>{fgLabel}</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 relative">
            <div className="absolute top-1/2 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 shadow-md"
              style={{ left: `${fg}%`, transform: 'translate(-50%, -50%)' }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">散户情绪</span>
            <span className={`font-mono text-sm font-bold ${(data.retail_sentiment_score ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {(data.retail_sentiment_score ?? 0) > 0 ? '+' : ''}{data.retail_sentiment_score ?? 0}
            </span>
          </div>
          {tickers.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-more mb-1.5">热门讨论</p>
              {tickers.slice(0, 4).map(t => (
                <div key={t.ticker} className="flex items-center justify-between py-1 border-b timeline-border last:border-0">
                  <span className="font-mono text-xs font-bold">{t.ticker}</span>
                  <span className={`text-[10px] font-semibold ${
                    t.mention_sentiment === 'bullish' ? 'text-emerald-500' : t.mention_sentiment === 'bearish' ? 'text-rose-500' : 'text-muted'
                  }`}>{t.mention_sentiment === 'bullish' ? '看多' : t.mention_sentiment === 'bearish' ? '看空' : '混合'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
