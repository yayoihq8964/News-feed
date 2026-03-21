import { useApi } from '../../hooks/useApi'
import { usePolling } from '../../hooks/usePolling'
import { getAnalysisStats, getXSentiment, getCalendar, getMarketQuotes, type MarketQuote } from '../../services/api'
import type { AnalysisStats, XSentiment, CalendarEvent } from '../../types'
import FearGreedGauge from './FearGreedGauge'
import SectorCard from './SectorCard'
import LoadingSpinner from '../common/LoadingSpinner'

export default function SentimentDashboard() {
  const statsApi = useApi<AnalysisStats>(() => getAnalysisStats(), [])
  const xApi = useApi<XSentiment | null>(() => getXSentiment(), [])
  const calendarApi = useApi<{ events: CalendarEvent[]; count: number }>(() => getCalendar(), [])
  const quotesApi = useApi<{ quotes: MarketQuote[] }>(() => getMarketQuotes(), [])

  usePolling(() => {
    statsApi.refetch()
    xApi.refetch()
  }, 60_000)

  const stats = statsApi.data
  const xData = xApi.data
  const fearGreed = xData?.fear_greed_estimate ?? (stats ? Math.round(50 + (stats.avg_sentiment ?? 0) * 5) : 50)
  const quotes = quotesApi.data?.quotes ?? []
  const events = calendarApi.data?.events?.slice(0, 5) ?? []

  // Build sector breakdown from stats
  const sectors = stats?.sector_breakdown
    ? Object.entries(stats.sector_breakdown).map(([name, count]) => ({
        name,
        count,
        score: Math.round(((stats.bullish_count - stats.bearish_count) / Math.max(stats.total_analyzed, 1)) * 100),
      }))
    : [
        { name: 'Technology', count: 0, score: 0 },
        { name: 'Finance', count: 0, score: 0 },
        { name: 'Energy', count: 0, score: 0 },
        { name: 'Healthcare', count: 0, score: 0 },
      ]

  // Narratives from X sentiment or fallback
  const narratives = xData?.key_narratives ?? []

  // Loading state
  if (statsApi.loading && !stats) {
    return <LoadingSpinner className="py-20" />
  }

  return (
    <div className="flex gap-0">
      {/* Main Content */}
      <main className="flex-1 xl:mr-80 p-6 md:p-8 space-y-10">
        {/* Hero Section with Fear & Greed */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 p-8 md:p-12">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500 rounded-full blur-[150px]" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary rounded-full blur-[120px]" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold tracking-wide text-white/80 mb-6">
              <span className="material-symbols-outlined text-[14px]">psychology</span>
              MARKET SENTIMENT ENGINE
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold font-headline tracking-tight text-white mb-4">
              Fear &amp; Greed Index
            </h1>
            <p className="text-white/60 text-lg max-w-2xl leading-relaxed mb-8">
              AI-powered sentiment aggregation across news sources and LLM-estimated social signals.
            </p>
            <FearGreedGauge value={fearGreed} />
          </div>
        </section>

        {/* Sector Sentiment Grid */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-extrabold font-headline dark:text-white">Sector Sentiment</h2>
              <p className="text-sm text-on-surface-variant dark:text-slate-400 mt-1">
                AI-analyzed breakdown by market sector
              </p>
            </div>
            {stats && (
              <div className="hidden md:flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-tertiary dark:bg-emerald-500" />
                  <span className="text-on-surface-variant dark:text-slate-400">Bullish: {stats.bullish_count}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-error dark:bg-red-500" />
                  <span className="text-on-surface-variant dark:text-slate-400">Bearish: {stats.bearish_count}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-on-surface-variant dark:text-slate-400">Neutral: {stats.neutral_count}</span>
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectors.map((sector) => (
              <SectorCard
                key={sector.name}
                name={sector.name}
                score={sector.score}
                count={sector.count}
              />
            ))}
          </div>
        </section>

        {/* AI Market Narrative */}
        <section className="bg-surface-container-lowest dark:bg-slate-900 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">auto_awesome</span>
            </div>
            <div>
              <h3 className="font-bold font-headline dark:text-white">The Oracle's Narrative</h3>
              <p className="text-xs text-on-surface-variant dark:text-slate-400">AI-generated market summary</p>
            </div>
          </div>
          {narratives.length > 0 ? (
            <div className="space-y-4">
              {narratives.map((narrative, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-primary/60 dark:bg-violet-400/60 flex-shrink-0" />
                  <p className="text-sm text-on-surface-variant dark:text-slate-300 leading-relaxed">{narrative}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant dark:text-slate-500 italic">
              Narratives will appear after social sentiment estimation is run. Trigger a refresh to generate LLM-based market narratives.
            </p>
          )}
        </section>

        {/* Asset Impact Grid */}
        {quotes.length > 0 && (
          <section>
            <h2 className="text-xl font-extrabold font-headline mb-6 dark:text-white">Market Pulse</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quotes.slice(0, 8).map((q) => {
                const isPositive = (q.changePercent ?? 0) >= 0
                return (
                  <div
                    key={q.symbol}
                    className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl p-4 space-y-2 border border-transparent hover:border-primary/20 dark:hover:border-violet-400/20 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">{q.label || q.name}</span>
                      <span className={`material-symbols-outlined text-sm ${isPositive ? 'text-tertiary dark:text-emerald-400' : 'text-error dark:text-red-400'}`}>
                        {isPositive ? 'trending_up' : 'trending_down'}
                      </span>
                    </div>
                    <p className="text-lg font-black dark:text-white">
                      {q.price != null ? q.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                    </p>
                    <p className={`text-sm font-bold ${isPositive ? 'text-tertiary dark:text-emerald-400' : 'text-error dark:text-red-400'}`}>
                      {isPositive ? '+' : ''}{q.changePercent?.toFixed(2) ?? '0.00'}%
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Macro Catalysts */}
        {events.length > 0 && (
          <section>
            <h2 className="text-xl font-extrabold font-headline mb-6 dark:text-white">Upcoming Catalysts</h2>
            <div className="space-y-3">
              {events.map((event, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 bg-surface-container-lowest dark:bg-slate-900 rounded-xl hover:shadow-md transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-surface-container dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary dark:text-violet-400">
                      {event.impact === 'high' ? 'priority_high' : event.impact === 'medium' ? 'calendar_today' : 'event'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate dark:text-white">{event.title}</p>
                    <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-0.5">
                      {event.country} · {event.date}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      event.impact === 'high' ? 'text-error dark:text-red-400' :
                      event.impact === 'medium' ? 'text-amber-600 dark:text-amber-400' :
                      'text-on-surface-variant dark:text-slate-500'
                    }`}>
                      {event.impact}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trending Tickers from X */}
        {xData && xData.trending_tickers.length > 0 && (
          <section className="bg-surface-container-lowest dark:bg-slate-900 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-bold font-headline dark:text-white">Social Buzz</h3>
              <span className="text-[10px] font-bold bg-surface-container dark:bg-slate-700 text-on-surface-variant dark:text-slate-400 px-2 py-0.5 rounded-full uppercase">LLM Estimate</span>
            </div>
            <p className="text-xs text-on-surface-variant dark:text-slate-400 mb-4">
              Retail sentiment: <span className={`font-bold ${xData.retail_sentiment_score >= 0 ? 'text-tertiary dark:text-emerald-400' : 'text-error dark:text-red-400'}`}>
                {xData.retail_sentiment_score > 0 ? '+' : ''}{xData.retail_sentiment_score}
              </span>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {xData.trending_tickers.slice(0, 8).map((t) => (
                <div key={t.ticker} className="bg-surface-container dark:bg-slate-800 rounded-xl p-3 text-center">
                  <p className="font-mono font-bold text-sm dark:text-white">{t.ticker}</p>
                  <p className={`text-xs font-semibold mt-1 ${
                    t.mention_sentiment === 'bullish' ? 'text-tertiary dark:text-emerald-400' :
                    t.mention_sentiment === 'bearish' ? 'text-error dark:text-red-400' :
                    'text-on-surface-variant dark:text-slate-400'
                  }`}>
                    {t.mention_sentiment === 'bullish' ? '🟢 Bullish' : t.mention_sentiment === 'bearish' ? '🔴 Bearish' : '⚪ Mixed'}
                  </p>
                  <p className="text-[10px] text-on-surface-variant dark:text-slate-500 mt-1 capitalize">
                    {t.buzz_level} buzz
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-8 border-t border-surface-container dark:border-slate-800 text-center">
          <p className="text-[10px] text-on-surface-variant dark:text-slate-500 tracking-widest uppercase mb-3">
            Powered by The Lucid Oracle Engine
          </p>
          <div className="flex justify-center gap-6 text-on-surface-variant dark:text-slate-500 text-xs font-semibold">
            <a className="hover:text-on-surface dark:hover:text-white transition-colors" href="#">Privacy Policy</a>
            <a className="hover:text-on-surface dark:hover:text-white transition-colors" href="#">API Documentation</a>
            <a className="hover:text-on-surface dark:hover:text-white transition-colors" href="#">Terms of Service</a>
          </div>
        </footer>
      </main>

      {/* Right Sidebar - Commodity & Market Data */}
      <aside className="hidden xl:block fixed right-0 top-16 w-80 h-[calc(100vh-64px)] p-6 overflow-y-auto custom-scrollbar bg-surface-container-low dark:bg-slate-900/50 border-l border-surface-container dark:border-slate-800">
        <div className="space-y-8">
          {/* Quick Stats */}
          {stats && (
            <div className="space-y-4">
              <h3 className="text-sm font-black font-headline tracking-widest uppercase text-on-surface-variant dark:text-slate-400">
                Analysis Summary
              </h3>
              <div className="bg-surface-container-lowest dark:bg-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-on-surface-variant dark:text-slate-400">Total Analyzed</span>
                  <span className="font-bold dark:text-white">{stats.total_analyzed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-on-surface-variant dark:text-slate-400">Avg Sentiment</span>
                  <span className={`font-bold ${(stats.avg_sentiment ?? 0) >= 0 ? 'text-tertiary dark:text-emerald-400' : 'text-error dark:text-red-400'}`}>
                    {(stats.avg_sentiment ?? 0) > 0 ? '+' : ''}{(stats.avg_sentiment ?? 0).toFixed(1)}
                  </span>
                </div>
                <div className="h-px bg-surface-container dark:bg-slate-700" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-black text-tertiary dark:text-emerald-400">{stats.bullish_count}</p>
                    <p className="text-[10px] font-bold text-on-surface-variant dark:text-slate-500 uppercase">Bull</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-400">{stats.neutral_count}</p>
                    <p className="text-[10px] font-bold text-on-surface-variant dark:text-slate-500 uppercase">Neutral</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-error dark:text-red-400">{stats.bearish_count}</p>
                    <p className="text-[10px] font-bold text-on-surface-variant dark:text-slate-500 uppercase">Bear</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Commodity Impact */}
          <div className="space-y-4">
            <h3 className="text-sm font-black font-headline tracking-widest uppercase text-on-surface-variant dark:text-slate-400">
              Commodity Watch
            </h3>
            {quotes.filter(q => ['Gold', 'Oil', 'Silver'].some(c => (q.name || '').includes(c) || (q.label || '').includes(c))).length > 0 ? (
              <div className="space-y-3">
                {quotes
                  .filter(q => ['Gold', 'Oil', 'Silver', 'Copper'].some(c => (q.name || '').toLowerCase().includes(c.toLowerCase()) || (q.label || '').toLowerCase().includes(c.toLowerCase())))
                  .slice(0, 4)
                  .map(q => {
                    const isPositive = (q.changePercent ?? 0) >= 0
                    return (
                      <div key={q.symbol} className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-lowest dark:bg-slate-800 border border-transparent dark:border-slate-700/50">
                        <div className="w-10 h-10 rounded-xl bg-surface-container dark:bg-slate-700 flex items-center justify-center">
                          <span className="material-symbols-outlined text-amber-500">
                            {(q.name || '').toLowerCase().includes('gold') ? 'diamond' : 'oil_barrel'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm dark:text-white">{q.label || q.name}</p>
                          <p className="text-xs text-on-surface-variant dark:text-slate-400">
                            {q.price != null ? `$${q.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                          </p>
                        </div>
                        <span className={`text-sm font-bold ${isPositive ? 'text-tertiary dark:text-emerald-400' : 'text-error dark:text-red-400'}`}>
                          {isPositive ? '+' : ''}{q.changePercent?.toFixed(2) ?? '0.00'}%
                        </span>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { name: 'Crude Oil', icon: 'oil_barrel', price: '—' },
                  { name: 'Gold (XAU)', icon: 'diamond', price: '—' },
                  { name: 'Silver (XAG)', icon: 'toll', price: '—' },
                ].map(c => (
                  <div key={c.name} className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-lowest dark:bg-slate-800">
                    <div className="w-10 h-10 rounded-xl bg-surface-container dark:bg-slate-700 flex items-center justify-center">
                      <span className="material-symbols-outlined text-amber-500">{c.icon}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm dark:text-white">{c.name}</p>
                      <p className="text-xs text-on-surface-variant dark:text-slate-400">{c.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Meme Stock Alerts */}
          {xData && xData.meme_stocks.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black font-headline tracking-widest uppercase text-on-surface-variant dark:text-slate-400">
                Meme Stock Alerts
              </h3>
              <div className="space-y-2">
                {xData.meme_stocks.map(m => (
                  <div key={m.ticker} className="bg-error-container/20 dark:bg-red-500/10 border border-error/20 dark:border-red-500/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-sm dark:text-white">{m.ticker}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        m.risk_level === 'high' ? 'bg-error/20 text-error dark:text-red-400' :
                        'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>{m.risk_level} risk</span>
                    </div>
                    <p className="text-xs text-on-surface-variant dark:text-slate-400">{m.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
