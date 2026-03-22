import { useApi } from '../../hooks/useApi'
import { getMarketQuotes } from '../../services/api'
import type { AnalysisStats } from '../../types'

interface MarketSidebarProps {
  stats?: AnalysisStats | null
}

export default function MarketSidebar({ stats }: MarketSidebarProps) {
  const quotesApi = useApi(getMarketQuotes, [])
  const quotes = quotesApi.data?.quotes ?? []

  const fearGreed = stats ? (() => {
    const { bullish_count = 0, bearish_count = 0, neutral_count = 0 } = stats
    const total = bullish_count + bearish_count + neutral_count
    if (total === 0) return 50
    return Math.round((bullish_count / total) * 100)
  })() : 50

  const sentimentLabel = fearGreed >= 70 ? '贪婪' : fearGreed >= 55 ? '乐观' : fearGreed >= 45 ? '中性' : fearGreed >= 30 ? '恐惧' : '极度恐惧'

  const trendingQuotes = quotes.slice(0, 5)

  return (
    <aside className="hidden xl:block fixed right-0 top-16 w-80 h-[calc(100vh-64px)] p-6 bg-surface-container-low dark:bg-slate-900 overflow-y-auto custom-scrollbar z-40">
      <div className="space-y-8">
        {/* Trending Stocks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black font-headline tracking-widest uppercase text-on-surface-variant dark:text-slate-400">
              热门行情
            </h3>
            <span className="material-symbols-outlined text-slate-400 text-lg">bolt</span>
          </div>

          <div className="space-y-3">
            {trendingQuotes.length > 0 ? (
              trendingQuotes.map((quote) => {
                const pct = quote.changePercent ?? 0
                const isPos = pct >= 0
                const price = quote.price ?? quote.previousClose ?? 0
                const isClosed = pct === 0 && quote.change === 0
                // Simulate 52-week range: ±30% from current price
                const low52 = price * 0.7
                const high52 = price * 1.15
                const range = high52 - low52
                const position = range > 0 ? ((price - low52) / range) * 100 : 50
                return (
                  <div key={quote.symbol} className="bg-surface-container-lowest dark:bg-slate-800 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-sm dark:text-slate-100">{quote.symbol}</span>
                        <p className="text-[10px] text-on-surface-variant dark:text-slate-500">{quote.name || quote.label}</p>
                      </div>
                      <div className="text-right">
                        {isClosed ? (
                          <span className="text-[10px] font-bold text-on-surface-variant dark:text-slate-500 bg-surface-container dark:bg-slate-700 px-2 py-0.5 rounded-full">已收盘</span>
                        ) : (
                          <span className={`font-bold text-sm ${isPos ? 'text-tertiary dark:text-emerald-400' : 'text-error dark:text-red-400'}`}>
                            {isPos ? '+' : ''}{pct.toFixed(2)}%
                          </span>
                        )}
                        <p className="text-xs font-semibold dark:text-slate-300 mt-0.5">
                          {price > 0 ? price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                        </p>
                      </div>
                    </div>
                    {/* 52周价格范围 */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-on-surface-variant dark:text-slate-500">
                        <span>{low52.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span className="text-[9px] text-on-surface-variant/60 dark:text-slate-600">52周范围</span>
                        <span>{high52.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="relative w-full h-1.5 bg-surface-container dark:bg-slate-700 rounded-full">
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800 shadow-sm ${isClosed ? 'bg-slate-400' : isPos ? 'bg-tertiary dark:bg-emerald-500' : 'bg-error dark:bg-red-500'}`}
                          style={{ left: `calc(${Math.min(Math.max(position, 3), 97)}% - 5px)` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="space-y-3">
                {['IXIC', 'GSPC', 'N225'].map((sym) => (
                  <div key={sym} className="bg-surface-container-lowest dark:bg-slate-800 p-4 rounded-xl space-y-2 animate-pulse">
                    <div className="flex justify-between">
                      <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sentiment Gauge */}
        <div className="bg-surface-container-lowest dark:bg-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-xs font-black font-headline text-on-surface dark:text-slate-100">
            综合情绪
          </h3>
          <div className="relative pt-6 pb-2">
            <div className="h-2 w-full sentiment-gradient rounded-full" />
            <div
              className="absolute top-4 flex flex-col items-center -translate-x-1/2"
              style={{ left: `${fearGreed}%` }}
            >
              <div className="w-4 h-4 rounded-full bg-white border-2 border-primary shadow-lg shadow-primary/20" />
              <span className="text-[10px] font-bold mt-1 text-on-surface dark:text-slate-300 whitespace-nowrap">
                {fearGreed} ({sentimentLabel})
              </span>
            </div>
          </div>
          <div className="flex justify-between text-[10px] font-bold text-on-surface-variant dark:text-slate-500 tracking-wider uppercase">
            <span>恐惧</span>
            <span>中性</span>
            <span>贪婪</span>
          </div>
          {stats && (
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[
                { label: '看多', count: stats.bullish_count, color: 'text-tertiary dark:text-emerald-400' },
                { label: '中性', count: stats.neutral_count, color: 'text-slate-500' },
                { label: '看空', count: stats.bearish_count, color: 'text-error dark:text-red-400' },
              ].map(({ label, count, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-lg font-black ${color}`}>{count}</p>
                  <p className="text-[10px] font-bold text-on-surface-variant dark:text-slate-500 uppercase">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
