import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApi } from '../../hooks/useApi'
import { getCandles, getAssetProfile, getAssetSentiment, type MarketQuote, type CandleData, type AssetProfile, type AssetSentiment } from '../../services/api'

interface AssetDetailModalProps {
  quote: MarketQuote
  onClose: () => void
}

const TIMEFRAMES = ['1D', '1W', '1M', '1Y'] as const
type Timeframe = typeof TIMEFRAMES[number]

// ── SVG Candlestick renderer ────────────────────────────────────
const CHART_W = 800
const CHART_H = 300
const PAD = { top: 10, right: 10, bottom: 10, left: 10 }

function CandlestickChart({ data }: { data: CandleData }) {
  const { candles, ema20, sma50 } = data
  if (!candles.length) return <div className="h-64 md:h-80 flex items-center justify-center text-on-surface-variant dark:text-slate-500 text-sm">暂无数据</div>

  const allPrices = candles.flatMap(c => [c.high, c.low])
  const minP = Math.min(...allPrices)
  const maxP = Math.max(...allPrices)
  const range = maxP - minP || 1
  const padded = range * 0.08 // 8% vertical padding
  const low = minP - padded
  const high = maxP + padded
  const yRange = high - low

  const toY = (v: number) => PAD.top + (1 - (v - low) / yRange) * (CHART_H - PAD.top - PAD.bottom)
  const n = candles.length
  const barW = Math.max(2, Math.min(14, (CHART_W - PAD.left - PAD.right) / n * 0.6))
  const step = (CHART_W - PAD.left - PAD.right) / n
  const toX = (i: number) => PAD.left + step * i + step / 2

  // Y-axis labels (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = high - (yRange * i) / 4
    return { val, y: toY(val) }
  })

  // Build MA paths from time lookup
  const timeIdx = new Map(candles.map((c, i) => [c.time, i]))

  const maPath = (pts: { time: string; value: number }[]) => {
    const mapped = pts
      .map(p => ({ x: timeIdx.get(p.time), y: p.value }))
      .filter((p): p is { x: number; y: number } => p.x !== undefined)
    if (mapped.length < 2) return ''
    return mapped.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`).join(' ')
  }

  return (
    <div className="w-full h-64 md:h-80 relative">
      <svg className="w-full h-full" viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <line key={i} x1={0} x2={CHART_W} y1={t.y} y2={t.y} stroke="currentColor" className="text-outline-variant/15 dark:text-slate-700/50" strokeWidth={1} />
        ))}

        {/* SMA 50 (dashed, below EMA) */}
        {sma50.length > 1 && (
          <path d={maPath(sma50)} fill="none" stroke="#4953ac" strokeWidth={2.5} strokeDasharray="6,4" />
        )}

        {/* EMA 20 (solid) */}
        {ema20.length > 1 && (
          <path d={maPath(ema20)} fill="none" stroke="#6a1cf6" strokeWidth={2.5} />
        )}

        {/* Candlesticks */}
        {candles.map((c, i) => {
          const x = toX(i)
          const isUp = c.close >= c.open
          const color = isUp ? '#006a28' : '#b41340'
          const bodyTop = toY(Math.max(c.open, c.close))
          const bodyBot = toY(Math.min(c.open, c.close))
          const bodyH = Math.max(1, bodyBot - bodyTop)
          return (
            <g key={i}>
              {/* Wick */}
              <line x1={x} x2={x} y1={toY(c.high)} y2={toY(c.low)} stroke={color} strokeWidth={1.2} />
              {/* Body */}
              <rect x={x - barW / 2} y={bodyTop} width={barW} height={bodyH} fill={color} rx={1} />
            </g>
          )
        })}
      </svg>

      {/* Y-Axis Labels */}
      <div className="absolute left-1 top-0 bottom-0 flex flex-col justify-between text-[10px] font-bold text-on-surface-variant/50 dark:text-slate-500 pointer-events-none py-1">
        {yTicks.map((t, i) => (
          <span key={i} className="tabular-nums">
            {t.val >= 10000 ? t.val.toLocaleString(undefined, { maximumFractionDigits: 0 })
             : t.val >= 100 ? t.val.toLocaleString(undefined, { maximumFractionDigits: 1 })
             : t.val.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Format helpers ──────────────────────────────────────────────
function fmtLargeNum(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}

function fmtCompact(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// ── Main Modal ──────────────────────────────────────────────────
export default function AssetDetailModal({ quote, onClose }: AssetDetailModalProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('1D')
  const [visible, setVisible] = useState(false)

  // Fetch candle data (re-fetches on timeframe change)
  const candleApi = useApi<CandleData>(
    () => getCandles(quote.symbol, timeframe),
    [quote.symbol, timeframe],
  )
  // Fetch profile once
  const profileApi = useApi<AssetProfile>(
    () => getAssetProfile(quote.symbol),
    [quote.symbol],
  )
  // Fetch sentiment
  const sentimentApi = useApi<AssetSentiment>(
    () => getAssetSentiment(quote.symbol),
    [quote.symbol],
  )

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', onEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onEsc)
      document.body.style.overflow = ''
    }
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 200)
  }, [onClose])

  const price = quote.price ?? quote.previousClose ?? 0
  const pct = quote.changePercent ?? 0
  const change = quote.change ?? 0
  const isPos = pct > 0
  const isNeg = pct < 0

  const profile = profileApi.data
  const yearLow = profile?.year_low ?? quote.yearLow ?? price * 0.75
  const yearHigh = profile?.year_high ?? quote.yearHigh ?? price * 1.05
  const yearRange = yearHigh - yearLow
  const yearProgress = yearRange > 0 ? ((price - yearLow) / yearRange) * 100 : 50

  const isIndex = quote.type === 'index'
  const typeLabel = isIndex ? 'INDEX' : 'COMMODITY'
  const description = profile?.description
    ? (profile.description.length > 120 ? profile.description.slice(0, 120) + '…' : profile.description)
    : `${quote.name} market data & analysis.`

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 transition-all duration-200 ${
        visible ? 'bg-inverse-surface/10 backdrop-blur-md' : 'bg-transparent'
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className={`glass-modal w-full max-w-6xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative border border-white/40 dark:border-slate-700/40 transition-all duration-200 ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-6 text-on-surface-variant hover:text-primary dark:text-slate-400 dark:hover:text-violet-400 transition-colors p-2 z-50"
        >
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>

        {/* Content */}
        <div className="overflow-y-auto custom-scrollbar p-6 md:p-10 space-y-8">

          {/* ── Header ───────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="bg-primary/10 text-primary dark:bg-violet-500/20 dark:text-violet-300 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase font-headline">
                  {typeLabel}
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold font-headline tracking-tight text-on-surface dark:text-white">
                  {quote.name} ({quote.label})
                </h1>
              </div>
              <p className="text-on-surface-variant dark:text-slate-400 font-medium text-sm md:text-base">
                {description}
              </p>
            </div>
            <div className="text-left md:text-right flex-shrink-0">
              <div className="text-3xl md:text-4xl font-black font-headline text-on-surface dark:text-white tabular-nums">
                {price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className={`flex items-center md:justify-end gap-1 font-bold text-sm ${
                isPos ? 'text-tertiary dark:text-emerald-400' : isNeg ? 'text-error dark:text-red-400' : 'text-on-surface-variant'
              }`}>
                <span className="material-symbols-outlined text-sm">
                  {isPos ? 'trending_up' : isNeg ? 'trending_down' : 'trending_flat'}
                </span>
                <span>{isPos ? '+' : ''}{pct.toFixed(2)}% ({isPos ? '+' : ''}${Math.abs(change).toFixed(2)})</span>
              </div>
            </div>
          </div>

          {/* ── Chart + Sentiment ────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart */}
            <div className="lg:col-span-2 bg-surface-container-lowest dark:bg-slate-800 rounded-3xl p-5 md:p-6 shadow-sm border border-outline-variant/10 dark:border-slate-700/30">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div className="flex gap-2">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                        timeframe === tf
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant dark:text-slate-400 hover:bg-surface-container dark:hover:bg-slate-700'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                <div className="flex gap-5 text-[10px] font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-tight">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" /> EMA 20</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-secondary" /> SMA 50</span>
                </div>
              </div>

              {candleApi.loading && !candleApi.data ? (
                <div className="h-64 md:h-80 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : candleApi.data ? (
                <CandlestickChart data={candleApi.data} />
              ) : (
                <div className="h-64 md:h-80 flex items-center justify-center text-on-surface-variant dark:text-slate-500 text-sm">
                  加载失败
                </div>
              )}
            </div>

            {/* Oracle Sentiment */}
            <div className="rounded-[2rem] p-6 md:p-8 flex flex-col justify-between text-white bg-gradient-to-br from-[#6a1cf6] to-[#4953ac] shadow-2xl shadow-primary/20 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                    <span className="material-symbols-outlined text-white text-lg">psychology</span>
                  </div>
                  <h3 className="font-headline font-extrabold text-lg tracking-tight">Oracle Sentiment</h3>
                </div>
                {sentimentApi.loading && !sentimentApi.data ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : sentimentApi.data && sentimentApi.data.score != null ? (
                  <>
                    <div className="space-y-4 flex-1">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-[10px] font-bold text-white/70 uppercase tracking-[0.15em]">
                          {sentimentApi.data.signal ?? 'Neutral'}
                        </span>
                        <span className="text-3xl font-black font-headline leading-none">{sentimentApi.data.score}%</span>
                      </div>
                      <div className="relative h-2.5 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.6)] transition-all duration-500"
                          style={{ width: `${sentimentApi.data.score}%` }}
                        />
                      </div>
                      <p className="text-white/90 font-medium leading-relaxed text-sm pt-1">
                        {sentimentApi.data.description}
                      </p>
                      <div className="flex gap-4 text-[10px] font-bold text-white/60 pt-1">
                        <span>看多 <strong className="text-white">{sentimentApi.data.bullish}</strong></span>
                        <span>看空 <strong className="text-white">{sentimentApi.data.bearish}</strong></span>
                        <span>中性 <strong className="text-white">{sentimentApi.data.neutral}</strong></span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-6 flex-wrap">
                      {sentimentApi.data.tags.map((tag) => (
                        <span key={tag} className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-lg text-[10px] font-bold tracking-widest uppercase border border-white/10">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                    <span className="material-symbols-outlined text-white/40 text-4xl">analytics</span>
                    <p className="text-white/60 text-sm font-medium leading-relaxed">
                      暂无情绪数据<br />
                      <span className="text-[10px] text-white/40">运行新闻分析后自动生成</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Metrics ──────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-surface-container-low dark:bg-slate-800/60">
              <span className="text-[10px] font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-widest block mb-2">Market Cap</span>
              <span className="text-xl font-bold font-headline dark:text-white">
                {profile ? fmtLargeNum(profile.market_cap) : <Skeleton />}
              </span>
            </div>
            <div className="p-5 rounded-2xl bg-surface-container-low dark:bg-slate-800/60">
              <span className="text-[10px] font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-widest block mb-2">P/E Ratio</span>
              <span className="text-xl font-bold font-headline dark:text-white">
                {profile ? (profile.pe_ratio != null ? profile.pe_ratio.toFixed(2) : '—') : <Skeleton />}
              </span>
            </div>
            <div className="p-5 rounded-2xl bg-surface-container-low dark:bg-slate-800/60">
              <span className="text-[10px] font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-widest block mb-2">Dividend Yield</span>
              <span className="text-xl font-bold font-headline dark:text-white">
                {profile ? (profile.dividend_yield != null ? `${(profile.dividend_yield * 100).toFixed(2)}%` : '—') : <Skeleton />}
              </span>
            </div>
            <div className="p-5 rounded-2xl bg-surface-container-low dark:bg-slate-800/60">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-widest">52-Week Range</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold dark:text-slate-300 tabular-nums">{fmtCompact(yearLow)}</span>
                <div className="flex-1 h-2 bg-surface-container-high dark:bg-slate-700 rounded-full overflow-hidden relative">
                  <div className="absolute left-0 top-0 h-full bg-primary rounded-full" style={{ width: `${Math.min(yearProgress, 100)}%` }} />
                </div>
                <span className="text-[10px] font-bold dark:text-slate-300 tabular-nums">{fmtCompact(yearHigh)}</span>
              </div>
            </div>
          </div>

          {/* ── Action Bar ───────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-outline-variant/10 dark:border-slate-700/30">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                <div className="w-9 h-9 rounded-full bg-violet-200 dark:bg-violet-800 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                  <span className="material-symbols-outlined text-violet-600 dark:text-violet-300 text-sm">person</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-emerald-200 dark:bg-emerald-800 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-300 text-sm">person</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-surface-container-highest dark:bg-slate-700 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-on-surface-variant dark:text-slate-300">
                  +12
                </div>
              </div>
              <span className="text-xs font-medium text-on-surface-variant dark:text-slate-400">Top analysts are currently watching this.</span>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button className="flex-1 sm:flex-none px-8 py-3.5 bg-primary text-on-primary rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-primary/20 active:scale-95 transition-all hover:shadow-xl">
                Execute Trade
              </button>
              <button className="px-4 py-3.5 bg-surface-container-highest dark:bg-slate-700 text-on-surface dark:text-slate-200 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                <span className="material-symbols-outlined">star</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Tiny skeleton placeholder
function Skeleton() {
  return <span className="inline-block w-16 h-5 bg-surface-container-high dark:bg-slate-700 rounded animate-pulse" />
}
