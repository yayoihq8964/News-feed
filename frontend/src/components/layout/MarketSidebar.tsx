import { useApi } from '../../hooks/useApi'
import { getMarketQuotes, getAnalysisStats } from '../../services/api'
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

  const sentimentLabel = fearGreed >= 70 ? 'Greed' : fearGreed >= 55 ? 'Optimism' : fearGreed >= 45 ? 'Neutral' : fearGreed >= 30 ? 'Fear' : 'Extreme Fear'

  const positiveQuotes = quotes.filter(q => (q.changePercent ?? 0) >= 0).slice(0, 3)
  const negativeQuotes = quotes.filter(q => (q.changePercent ?? 0) < 0).slice(0, 2)
  const trendingQuotes = [...positiveQuotes, ...negativeQuotes].slice(0, 5)

  return (
    <aside className="hidden xl:block fixed right-0 top-16 w-80 h-[calc(100vh-64px)] p-6 bg-surface-container-low dark:bg-slate-900 overflow-y-auto custom-scrollbar z-40">
      <div className="space-y-8">
        {/* Trending Stocks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black font-headline tracking-widest uppercase text-on-surface-variant dark:text-slate-400">
              Trending Stocks
            </h3>
            <span className="material-symbols-outlined text-slate-400 text-lg">bolt</span>
          </div>

          <div className="space-y-3">
            {trendingQuotes.length > 0 ? (
              trendingQuotes.map((quote) => {
                const pct = quote.changePercent ?? 0
                const isPos = pct >= 0
                const barWidth = Math.min(Math.abs(pct) * 10, 100)
                return (
                  <div key={quote.symbol} className="bg-surface-container-lowest dark:bg-slate-800 p-4 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm dark:text-slate-100">{quote.symbol}</span>
                      <span className={`font-bold text-sm ${isPos ? 'text-tertiary dark:text-emerald-400' : 'text-error dark:text-red-400'}`}>
                        {isPos ? '+' : ''}{pct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="w-full bg-surface-container dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isPos ? 'bg-tertiary dark:bg-emerald-500' : 'bg-error dark:bg-red-500'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-on-surface-variant dark:text-slate-500 font-bold">
                      <span>{quote.name}</span>
                      {quote.price && <span>${quote.price.toFixed(2)}</span>}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="space-y-3">
                {['NVDA', 'TSLA', 'MSFT'].map((sym, i) => (
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
            Overall Sentiment
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
            <span>Fear</span>
            <span>Neutral</span>
            <span>Greed</span>
          </div>
          {stats && (
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[
                { label: 'Bullish', count: stats.bullish_count, color: 'text-tertiary dark:text-emerald-400' },
                { label: 'Neutral', count: stats.neutral_count, color: 'text-slate-500' },
                { label: 'Bearish', count: stats.bearish_count, color: 'text-error dark:text-red-400' },
              ].map(({ label, count, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-lg font-black ${color}`}>{count}</p>
                  <p className="text-[10px] font-bold text-on-surface-variant dark:text-slate-500 uppercase">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Featured Card */}
        <div className="relative overflow-hidden group rounded-2xl aspect-[4/5] bg-inverse-surface dark:bg-slate-800 cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900 to-slate-900 opacity-80" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 space-y-2">
            <div className="text-[10px] font-black text-primary-fixed bg-on-primary-fixed-variant px-2 py-1 rounded w-fit">
              DEEP DIVE
            </div>
            <h4 className="text-white font-bold leading-tight">The 2025 Macro Outlook</h4>
            <p className="text-white/70 text-xs leading-relaxed">
              An Oracle exclusive report on central bank policy and global market dynamics.
            </p>
            <button className="flex items-center gap-2 text-white text-xs font-bold pt-2 group-hover:gap-4 transition-all">
              Read Report <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
