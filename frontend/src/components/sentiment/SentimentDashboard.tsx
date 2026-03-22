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

  // Merge fine-grained sectors into major categories
  const SECTOR_MAP: Record<string, string> = {
    '半导体': '科技', '科技硬件': '科技', '大型科技股': '科技', '人工智能': '科技',
    '软件': '科技', '消费电子': '科技', '存储芯片': '科技', '芯片设计': '科技',
    '互联网内容与社交媒体': '科技', '广告技术': '科技', '中国互联网与科技硬件': '科技',
    '网络安全': '科技', '信息技术': '科技',
    '能源': '能源', '可再生能源': '能源', '油气上游': '能源', '油服': '能源', '化工': '能源',
    '贵金属': '大宗商品',
    '金融服务': '金融', '支付服务': '金融', '保险': '金融',
    '新能源汽车': '汽车', '自动驾驶': '汽车', '自动驾驶技术': '汽车',
    '汽车制造': '汽车', '出行平台': '汽车', '车联网与智能汽车': '汽车',
    '航空': '交运', '运输': '交运', '物流运输': '交运', '物流与包裹递送': '交运',
    '防务': '国防', '大盘指数': '指数', '宽基指数ETF': '指数', '美股大盘股': '指数',
    '电子商务': '消费', '在线零售': '消费', '必需消费品': '消费',
    '餐饮': '消费', '消费服务': '消费',
    '公用事业': '公用事业', '公用事业板块': '公用事业', '公用事业/基建': '公用事业',
    '包装材料': '工业', '大型价值股': '价值',
  }

  const sectorSentiment = stats?.sector_sentiment ?? {}
  const merged: Record<string, { count: number; totalSent: number; bullish: number; bearish: number; neutral: number }> = {}

  for (const [rawSector, data] of Object.entries(sectorSentiment)) {
    const major = SECTOR_MAP[rawSector] || '其他'
    if (!merged[major]) merged[major] = { count: 0, totalSent: 0, bullish: 0, bearish: 0, neutral: 0 }
    merged[major].count += data.count
    merged[major].totalSent += data.avg_sentiment * data.count
    merged[major].bullish += data.bullish
    merged[major].bearish += data.bearish
    merged[major].neutral += data.neutral
  }

  const sectors = Object.entries(merged)
    .map(([name, d]) => ({
      name,
      count: d.count,
      score: Math.round(d.totalSent / Math.max(d.count, 1)),
    }))
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count)

  const narratives = xData?.key_narratives ?? []

  if (statsApi.loading && !stats) {
    return <LoadingSpinner className="py-20" />
  }

  return (
    <div className="flex gap-0">
      <main className="flex-1 xl:mr-80 p-4 md:p-6 lg:p-8 space-y-10">
        {/* Hero - Fear & Greed */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 p-6 md:p-12">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500 rounded-full blur-[150px]" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary rounded-full blur-[120px]" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold tracking-wide text-white/80 mb-6">
              <span className="material-symbols-outlined text-[14px]">psychology</span>
              市场情绪引擎
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold font-headline tracking-tight text-white mb-4">
              恐惧与贪婪指数
            </h1>
            <p className="text-white/60 text-sm md:text-lg max-w-2xl leading-relaxed mb-8">
              基于AI的新闻与社交信号情绪聚合分析
            </p>
            <FearGreedGauge value={fearGreed} />
          </div>
        </section>

        {/* Sector Sentiment */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-extrabold font-headline dark:text-white">板块情绪</h2>
              <p className="text-sm text-on-surface-variant dark:text-slate-400 mt-1">AI分析各市场板块情绪走势</p>
            </div>
            {stats && (
              <div className="hidden md:flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-tertiary dark:bg-emerald-500" />
                  <span className="text-on-surface-variant dark:text-slate-400">看多: {stats.bullish_count}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-error dark:bg-red-500" />
                  <span className="text-on-surface-variant dark:text-slate-400">看空: {stats.bearish_count}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-on-surface-variant dark:text-slate-400">中性: {stats.neutral_count}</span>
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {sectors.map((sector) => (
              <SectorCard key={sector.name} name={sector.name} score={sector.score} count={sector.count} />
            ))}
          </div>
        </section>

        {/* AI Narrative */}
        <section className="bg-surface-container-lowest dark:bg-slate-900 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">auto_awesome</span>
            </div>
            <div>
              <h3 className="font-bold font-headline dark:text-white">AI市场解读</h3>
              <p className="text-xs text-on-surface-variant dark:text-slate-400">AI生成的市场趋势摘要</p>
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
              运行社交情绪估算后将在此显示AI生成的市场叙事
            </p>
          )}
        </section>

        {/* Market Pulse */}
        {quotes.length > 0 && (
          <section>
            <h2 className="text-xl font-extrabold font-headline mb-6 dark:text-white">市场脉搏</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quotes.slice(0, 8).map((q) => {
                const isPositive = (q.changePercent ?? 0) >= 0
                return (
                  <div key={q.symbol} className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl p-4 space-y-2 border border-transparent hover:border-primary/20 dark:hover:border-violet-400/20 transition-all">
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

        {/* Upcoming Events */}
        {events.length > 0 && (
          <section>
            <h2 className="text-xl font-extrabold font-headline mb-6 dark:text-white">即将发布的重要数据</h2>
            <div className="space-y-3">
              {events.map((event, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-surface-container-lowest dark:bg-slate-900 rounded-xl hover:shadow-md transition-all">
                  <div className="w-12 h-12 rounded-xl bg-surface-container dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary dark:text-violet-400">
                      {event.impact === 'high' ? 'priority_high' : event.impact === 'medium' ? 'calendar_today' : 'event'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate dark:text-white">{event.title}</p>
                    <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-0.5">{event.country} · {event.date}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      event.impact === 'high' ? 'text-error dark:text-red-400' :
                      event.impact === 'medium' ? 'text-amber-600 dark:text-amber-400' :
                      'text-on-surface-variant dark:text-slate-500'
                    }`}>
                      {event.impact === 'high' ? '高' : event.impact === 'medium' ? '中' : '低'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Social Buzz */}
        {xData && xData.trending_tickers.length > 0 && (
          <section className="bg-surface-container-lowest dark:bg-slate-900 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-bold font-headline dark:text-white">社交热议</h3>
              <span className="text-[10px] font-bold bg-surface-container dark:bg-slate-700 text-on-surface-variant dark:text-slate-400 px-2 py-0.5 rounded-full uppercase">AI估算</span>
            </div>
            <p className="text-xs text-on-surface-variant dark:text-slate-400 mb-4">
              散户情绪: <span className={`font-bold ${xData.retail_sentiment_score >= 0 ? 'text-tertiary dark:text-emerald-400' : 'text-error dark:text-red-400'}`}>
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
                    {t.mention_sentiment === 'bullish' ? '🟢 看多' : t.mention_sentiment === 'bearish' ? '🔴 看空' : '⚪ 混合'}
                  </p>
                  <p className="text-[10px] text-on-surface-variant dark:text-slate-500 mt-1">
                    热度: {t.buzz_level === 'high' ? '高' : t.buzz_level === 'medium' ? '中' : '低'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-8 border-t border-surface-container dark:border-slate-800 text-center">
          <p className="text-[10px] text-on-surface-variant dark:text-slate-500 tracking-widest uppercase mb-3">
            由MacroLens分析引擎驱动
          </p>
          <div className="flex justify-center gap-6 text-on-surface-variant dark:text-slate-500 text-xs font-semibold">
            <a className="hover:text-on-surface dark:hover:text-white transition-colors" href="#">隐私政策</a>
            <a className="hover:text-on-surface dark:hover:text-white transition-colors" href="#">API文档</a>
            <a className="hover:text-on-surface dark:hover:text-white transition-colors" href="#">服务条款</a>
          </div>
        </footer>
      </main>

      {/* Right Sidebar */}
      <aside className="hidden xl:block fixed right-0 top-16 w-80 h-[calc(100vh-64px)] p-6 overflow-y-auto custom-scrollbar bg-surface-container-low dark:bg-slate-900/50 border-l border-surface-container dark:border-slate-800">
        <div className="space-y-8">
          {stats && (
            <div className="space-y-4">
              <h3 className="text-sm font-black font-headline tracking-widest uppercase text-on-surface-variant dark:text-slate-400">分析概览</h3>
              <div className="bg-surface-container-lowest dark:bg-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-on-surface-variant dark:text-slate-400">已分析总数</span>
                  <span className="font-bold dark:text-white">{stats.total_analyzed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-on-surface-variant dark:text-slate-400">平均情绪</span>
                  <span className={`font-bold ${(stats.avg_sentiment ?? 0) >= 0 ? 'text-tertiary dark:text-emerald-400' : 'text-error dark:text-red-400'}`}>
                    {(stats.avg_sentiment ?? 0) > 0 ? '+' : ''}{(stats.avg_sentiment ?? 0).toFixed(1)}
                  </span>
                </div>
                <div className="h-px bg-surface-container dark:bg-slate-700" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-black text-tertiary dark:text-emerald-400">{stats.bullish_count}</p>
                    <p className="text-[10px] font-bold text-on-surface-variant dark:text-slate-500">看多</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-400">{stats.neutral_count}</p>
                    <p className="text-[10px] font-bold text-on-surface-variant dark:text-slate-500">中性</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-error dark:text-red-400">{stats.bearish_count}</p>
                    <p className="text-[10px] font-bold text-on-surface-variant dark:text-slate-500">看空</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-black font-headline tracking-widest uppercase text-on-surface-variant dark:text-slate-400">大宗商品</h3>
            {(() => {
              const commodities = quotes.filter(q => (q as any).type === 'commodity' || ['Gold', 'Oil', 'Silver'].some(c => (q.name || '').includes(c)))
              return commodities.length > 0 ? (
                <div className="space-y-3">
                  {commodities.slice(0, 4).map(q => {
                    const price = q.price ?? q.previousClose ?? 0
                    const pct = q.changePercent ?? 0
                    const isPositive = pct > 0
                    const isNeg = pct < 0
                    return (
                      <div key={q.symbol} className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-lowest dark:bg-slate-800">
                        <div className="w-10 h-10 rounded-xl bg-surface-container dark:bg-slate-700 flex items-center justify-center">
                          <span className="material-symbols-outlined text-amber-500">
                            {(q.name || '').includes('Gold') ? 'diamond' : (q.name || '').includes('Oil') ? 'oil_barrel' : 'toll'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm dark:text-white">{q.label}</p>
                          <p className="text-xs text-on-surface-variant dark:text-slate-400">
                            {price > 0 ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                          </p>
                        </div>
                        <span className={`text-sm font-bold ${isPositive ? 'text-tertiary dark:text-emerald-400' : isNeg ? 'text-error dark:text-red-400' : 'text-slate-400'}`}>
                          {isPositive ? '+' : ''}{pct.toFixed(2)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant dark:text-slate-500 italic">加载中...</p>
              )
            })()}
          </div>

          {xData && xData.meme_stocks.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black font-headline tracking-widest uppercase text-on-surface-variant dark:text-slate-400">Meme股预警</h3>
              <div className="space-y-2">
                {xData.meme_stocks.map(m => (
                  <div key={m.ticker} className="bg-error-container/20 dark:bg-red-500/10 border border-error/20 dark:border-red-500/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-sm dark:text-white">{m.ticker}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        m.risk_level === 'high' ? 'bg-error/20 text-error dark:text-red-400' :
                        'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>{m.risk_level === 'high' ? '高风险' : '中风险'}</span>
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
