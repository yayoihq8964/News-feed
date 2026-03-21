import { useParams, Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { getAnalyses, getNews, triggerAnalysis } from '../../services/api'
import type { Analysis, NewsItem } from '../../types'
import LoadingSpinner from '../common/LoadingSpinner'
import SentimentChip from '../common/SentimentChip'
import NewsImage from '../news/NewsImage'
import { useState } from 'react'

export default function DeepAnalysis() {
  const { id } = useParams<{ id: string }>()
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)

  // If we have a specific news ID, load its analysis; otherwise load latest analyses
  const analysesApi = useApi<{ items: Analysis[]; total: number }>(
    () => getAnalyses({ page: 1, page_size: 20 }),
    []
  )
  const newsApi = useApi<{ items: NewsItem[]; total: number }>(() => getNews(), [])

  const analyses = analysesApi.data?.items ?? []
  const newsItems = newsApi.data?.items ?? []

  // Find the specific analysis if an ID is given
  const selectedNewsId = id ? parseInt(id) : null
  const selectedAnalysis = selectedNewsId
    ? analyses.find(a => a.news_id === selectedNewsId)
    : analyses[0]

  // Find matching news item for image
  const matchedNews = selectedAnalysis
    ? newsItems.find(n => n.id === selectedAnalysis.news_id)
    : null

  const handleTrigger = async () => {
    setTriggerMsg('Analysis triggered...')
    try {
      await triggerAnalysis()
      setTriggerMsg('Analysis running in background. Refresh in a moment.')
      setTimeout(() => {
        analysesApi.refetch()
        setTriggerMsg(null)
      }, 5000)
    } catch {
      setTriggerMsg('Failed to trigger analysis')
    }
  }

  if (analysesApi.loading && !analysesApi.data) {
    return <LoadingSpinner className="py-20" />
  }

  // No analysis data yet
  if (!selectedAnalysis) {
    return (
      <div className="flex-1 p-6 md:p-8">
        <div className="max-w-2xl mx-auto text-center py-20">
          <span className="material-symbols-outlined text-6xl text-primary/30 dark:text-violet-400/30 mb-6 block">
            psychology
          </span>
          <h2 className="text-2xl font-extrabold font-headline mb-4 dark:text-white">
            {selectedNewsId ? 'Analysis Not Found' : 'No Analyses Yet'}
          </h2>
          <p className="text-on-surface-variant dark:text-slate-400 mb-8 leading-relaxed">
            {selectedNewsId
              ? 'This news article hasn\'t been analyzed yet. Trigger an analysis to get AI-powered insights.'
              : 'Run the analysis engine to get AI-powered deep dives on your news articles.'}
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={handleTrigger}
              className="bg-gradient-to-r from-primary to-primary-container text-white px-6 py-3 rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-primary/20 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-sm align-middle mr-2">auto_awesome</span>
              Run Analysis
            </button>
            <Link
              to="/"
              className="px-6 py-3 rounded-xl font-bold text-sm border border-surface-container dark:border-slate-700 text-on-surface-variant dark:text-slate-400 hover:bg-surface-container dark:hover:bg-slate-800 transition-all"
            >
              Back to News
            </Link>
          </div>
          {triggerMsg && (
            <p className="mt-4 text-sm text-primary dark:text-violet-400 animate-pulse">{triggerMsg}</p>
          )}
        </div>
      </div>
    )
  }

  const classification = selectedAnalysis.classification as 'bullish' | 'bearish' | 'neutral'
  const isBullish = classification === 'bullish'
  const isBearish = classification === 'bearish'

  // Parse JSON strings from backend
  const affectedStocks = safeParseJson<Array<{ ticker: string; impact_score: number; reason: string }>>(selectedAnalysis.affected_stocks) ?? []
  const keyFactors = safeParseJson<string[]>(selectedAnalysis.key_factors) ?? []
  const affectedCommodities = safeParseJson<string[]>(selectedAnalysis.affected_commodities) ?? []
  const affectedSectors = safeParseJson<string[]>(selectedAnalysis.affected_sectors) ?? []

  // Confidence score
  const confidence = selectedAnalysis.confidence ?? 0

  return (
    <div className="flex gap-0">
      {/* Main Content */}
      <main className="flex-1 xl:mr-80 p-6 md:p-8 space-y-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-on-surface-variant dark:text-slate-500">
          <Link to="/" className="hover:text-primary dark:hover:text-violet-400 transition-colors">News</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-on-surface dark:text-slate-300">Deep Analysis</span>
        </div>

        {/* Hero */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <SentimentChip classification={classification} score={selectedAnalysis.overall_sentiment} />
            <span className="text-xs font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">
              Analyzed {selectedAnalysis.analyzed_at ? new Date(selectedAnalysis.analyzed_at).toLocaleString() : ''}
            </span>
            {selectedAnalysis.llm_provider && (
              <span className="text-[10px] font-bold text-on-surface-variant dark:text-slate-500 bg-surface-container dark:bg-slate-800 px-2 py-1 rounded-full uppercase">
                {selectedAnalysis.llm_provider} / {selectedAnalysis.llm_model}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight leading-tight dark:text-white">
            {selectedAnalysis.headline_summary || matchedNews?.title || 'Market Analysis'}
          </h1>

          {/* News Image */}
          {matchedNews?.image_url && (
            <div className="w-full h-48 md:h-64 rounded-2xl overflow-hidden">
              <NewsImage
                src={matchedNews.image_url}
                alt={matchedNews.title}
                className="w-full h-full"
              />
            </div>
          )}

          {/* Summary */}
          <div className="bg-surface-container-lowest dark:bg-slate-900 rounded-2xl p-6 md:p-8">
            <p className="text-on-surface-variant dark:text-slate-300 leading-relaxed text-lg">
              {selectedAnalysis.headline_summary}
            </p>
          </div>
        </section>

        {/* Confidence Score */}
        <section className="bg-surface-container-lowest dark:bg-slate-900 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-primary dark:text-violet-400">verified</span>
            <h3 className="font-bold font-headline dark:text-white">AI Confidence Score</h3>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-surface-container dark:text-slate-700"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className={isBullish ? 'text-tertiary dark:text-emerald-400' : isBearish ? 'text-error dark:text-red-400' : 'text-amber-500'}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${confidence}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black dark:text-white">{confidence}</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="font-bold dark:text-white mb-1">
                {confidence >= 80 ? 'High Confidence' : confidence >= 50 ? 'Moderate Confidence' : 'Low Confidence'}
              </p>
              <p className="text-sm text-on-surface-variant dark:text-slate-400 leading-relaxed">
                {isBullish
                  ? 'The analysis engine identifies a strong positive signal in the underlying data. Multiple corroborating factors suggest upward momentum.'
                  : isBearish
                  ? 'Warning signals detected across multiple indicators. The analysis suggests caution and potential downside risk.'
                  : 'Mixed signals across indicators. The market position is unclear and warrants monitoring.'}
              </p>
            </div>
          </div>
        </section>

        {/* Key Factors */}
        {keyFactors.length > 0 && (
          <section className="bg-surface-container-lowest dark:bg-slate-900 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-primary dark:text-violet-400">checklist</span>
              <h3 className="font-bold font-headline dark:text-white">Key Factors</h3>
            </div>
            <div className="space-y-3">
              {keyFactors.map((factor, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={`mt-1 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    isBullish
                      ? 'bg-tertiary-container text-on-tertiary-container'
                      : isBearish
                      ? 'bg-error-container text-on-error-container'
                      : 'bg-surface-container dark:bg-slate-700 text-on-surface-variant dark:text-slate-400'
                  }`}>
                    {i + 1}
                  </div>
                  <p className="text-sm text-on-surface-variant dark:text-slate-300 leading-relaxed">{factor}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Logic Chain */}
        {selectedAnalysis.logic_chain && (
          <section className="bg-surface-container-lowest dark:bg-slate-900 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-primary dark:text-violet-400">timeline</span>
              <h3 className="font-bold font-headline dark:text-white">The Oracle's Analysis</h3>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-on-surface-variant dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {selectedAnalysis.logic_chain}
              </p>
            </div>
          </section>
        )}

        {/* Affected Stocks */}
        {affectedStocks.length > 0 && (
          <section>
            <h3 className="font-bold font-headline mb-4 dark:text-white">Affected Stocks</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {affectedStocks.map((stock) => {
                const positive = stock.impact_score > 0
                return (
                  <div
                    key={stock.ticker}
                    className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold dark:text-white">{stock.ticker}</span>
                      <span className={`font-bold text-sm ${positive ? 'text-tertiary dark:text-emerald-400' : 'text-error dark:text-red-400'}`}>
                        {positive ? '▲' : '▼'} Impact: {Math.abs(stock.impact_score)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-container dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${positive ? 'bg-tertiary dark:bg-emerald-500' : 'bg-error dark:bg-red-500'}`}
                        style={{ width: `${Math.min(Math.abs(stock.impact_score) * 10, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-on-surface-variant dark:text-slate-400">{stock.reason}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Recent Analyses List (when no specific ID) */}
        {!selectedNewsId && analyses.length > 1 && (
          <section>
            <h3 className="text-xl font-extrabold font-headline mb-6 dark:text-white">Recent Analyses</h3>
            <div className="space-y-3">
              {analyses.slice(1, 10).map((a) => {
                const aNews = newsItems.find(n => n.id === a.news_id)
                return (
                  <Link
                    key={a.id}
                    to={`/analysis/${a.news_id}`}
                    className="flex items-center gap-4 p-4 bg-surface-container-lowest dark:bg-slate-900 rounded-xl hover:shadow-md transition-all group"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                      <NewsImage
                        src={aNews?.image_url}
                        alt={a.headline_summary || ''}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate group-hover:text-primary dark:text-white dark:group-hover:text-violet-400 transition-colors">
                        {a.headline_summary || aNews?.title || `Analysis #${a.id}`}
                      </p>
                      <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-1 truncate">
                        {a.headline_summary?.slice(0, 100)}...
                      </p>
                    </div>
                    <SentimentChip
                      classification={a.classification as 'bullish' | 'bearish' | 'neutral'}
                      size="sm"
                    />
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {/* Right Sidebar */}
      <aside className="hidden xl:block fixed right-0 top-16 w-80 h-[calc(100vh-64px)] p-6 overflow-y-auto custom-scrollbar bg-surface-container-low dark:bg-slate-900/50 border-l border-surface-container dark:border-slate-800">
        <div className="space-y-8">
          {/* Sector Impact */}
          {affectedSectors.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black font-headline tracking-widest uppercase text-on-surface-variant dark:text-slate-400">
                Sector Impact
              </h3>
              <div className="space-y-3">
                {affectedSectors.map((sector, i) => (
                  <div
                    key={i}
                    className="bg-surface-container-lowest dark:bg-slate-800 p-4 rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold dark:text-white">{sector}</span>
                      <span className={`material-symbols-outlined text-sm ${isBullish ? 'text-tertiary dark:text-emerald-400' : isBearish ? 'text-error dark:text-red-400' : 'text-slate-400'}`}>
                        {isBullish ? 'trending_up' : isBearish ? 'trending_down' : 'trending_flat'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-container dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isBullish ? 'bg-tertiary dark:bg-emerald-500' : isBearish ? 'bg-error dark:bg-red-500' : 'bg-slate-400'}`}
                        style={{ width: `${50 + (selectedAnalysis.overall_sentiment ?? 0) * 5}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commodity Impact */}
          {affectedCommodities.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black font-headline tracking-widest uppercase text-on-surface-variant dark:text-slate-400">
                Commodity Impact
              </h3>
              <div className="space-y-3">
                {affectedCommodities.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface-container-lowest dark:bg-slate-800 rounded-xl">
                    <span className="material-symbols-outlined text-amber-500">
                      {c.toLowerCase().includes('oil') ? 'oil_barrel' :
                       c.toLowerCase().includes('gold') ? 'diamond' :
                       c.toLowerCase().includes('wheat') || c.toLowerCase().includes('grain') ? 'grain' : 'toll'}
                    </span>
                    <span className="text-sm dark:text-slate-300">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Metrics */}
          <div className="space-y-4">
            <h3 className="text-sm font-black font-headline tracking-widest uppercase text-on-surface-variant dark:text-slate-400">
              Key Metrics
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Sentiment Score', value: selectedAnalysis.overall_sentiment?.toFixed(1) ?? '—', icon: 'monitoring' },
                { label: 'Confidence', value: `${confidence}%`, icon: 'verified' },
                { label: 'Classification', value: classification.charAt(0).toUpperCase() + classification.slice(1), icon: 'label' },
              ].map(m => (
                <div key={m.label} className="flex items-center gap-3 p-3 bg-surface-container-lowest dark:bg-slate-800 rounded-xl">
                  <span className="material-symbols-outlined text-primary dark:text-violet-400 text-xl">{m.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs text-on-surface-variant dark:text-slate-400">{m.label}</p>
                    <p className="font-bold text-sm dark:text-white">{m.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleTrigger}
              className="w-full py-3 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl text-xs font-bold hover:shadow-lg active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-sm align-middle mr-1">auto_awesome</span>
              Run New Analysis
            </button>
            {triggerMsg && (
              <p className="text-xs text-primary dark:text-violet-400 text-center animate-pulse">{triggerMsg}</p>
            )}
            <Link
              to="/"
              className="block w-full py-3 border border-surface-container dark:border-slate-700 text-on-surface-variant dark:text-slate-400 rounded-xl text-xs font-bold text-center hover:bg-surface-container dark:hover:bg-slate-800 transition-all"
            >
              Back to News Feed
            </Link>
          </div>
        </div>
      </aside>
    </div>
  )
}

// Utility to safely parse JSON strings from backend
function safeParseJson<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') return value as T
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return null
}
