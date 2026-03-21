import { useCallback, useState } from 'react'
import { getNews, getAnalysisStats, getXSentiment, getLatestAnalyses, triggerAnalysis, fetchNews, refreshXSentiment, getCalendar } from './services/api'
import { useApi } from './hooks/useApi'
import { usePolling } from './hooks/usePolling'

import Header from './components/Header'
import MarketIndices from './components/MarketIndices'
import NewsFeed from './components/NewsFeed'
import MarketSentiment from './components/MarketSentiment'
import MarketClock from './components/MarketClock'
import CommodityPanel from './components/CommodityPanel'
import XSentimentPanel from './components/XSentimentPanel'
import CalendarPanel from './components/CalendarPanel'
import TopStocks from './components/TopStocks'
import SettingsModal from './components/SettingsModal'

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [filter, setFilter] = useState<'all' | 'bullish' | 'bearish'>('all')

  const newsApi = useApi(() => getNews({ page_size: 25 }), [])
  const statsApi = useApi(getAnalysisStats, [])
  const xApi = useApi(getXSentiment, [])
  const analysesApi = useApi(() => getLatestAnalyses(200), [])
  const calendarApi = useApi(() => getCalendar().then(r => r.events), [])

  const refetchAll = useCallback(() => {
    newsApi.refetch(); statsApi.refetch(); xApi.refetch(); analysesApi.refetch()
  }, [newsApi, statsApi, xApi, analysesApi])

  usePolling(refetchAll, 30000, true)

  const handleFetch = async () => { await fetchNews(); setTimeout(refetchAll, 2000) }
  const handleAnalyze = async () => { await triggerAnalysis(); setTimeout(refetchAll, 3000) }
  const handleRefreshX = async () => {
    try { await refreshXSentiment(); setTimeout(() => xApi.refetch(), 5000); setTimeout(() => xApi.refetch(), 15000) } catch {}
  }

  const analyses = analysesApi.data ?? []
  const news = newsApi.data?.items ?? []

  return (
    <div className="min-h-screen page-bg">
      <Header stats={statsApi.data} onFetch={handleFetch} onAnalyze={handleAnalyze} onSettings={() => setShowSettings(true)} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-12">
        <MarketIndices />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <NewsFeed items={news} loading={newsApi.loading} filter={filter} onFilterChange={setFilter} />
          </div>
          <div className="lg:col-span-4 space-y-5">
            <MarketClock />
            <MarketSentiment stats={statsApi.data} />
            <CommodityPanel analyses={analyses} />
            <CalendarPanel events={calendarApi.data ?? []} loading={calendarApi.loading} />
            <XSentimentPanel data={xApi.data} loading={xApi.loading} onRefresh={handleRefreshX} />
            <TopStocks analyses={analyses} />
          </div>
        </div>
      </main>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
