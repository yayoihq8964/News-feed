import type { NewsItem } from '../../types'
import NewsImage from './NewsImage'
import SentimentChip from '../common/SentimentChip'

interface NewsCardProps {
  item: NewsItem
}

function timeAgo(dateStr: string): string {
  // Ensure UTC parsing if no timezone suffix
  const normalized = dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('T') ? dateStr : dateStr + 'Z'
  const date = new Date(normalized)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 0) return '刚刚'
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 172800) return '昨天'
  return `${Math.floor(diff / 86400)} 天前`
}

function toLocalTime(dateStr: string): string {
  const normalized = dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('T') ? dateStr : dateStr + 'Z'
  return new Date(normalized).toLocaleString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const GENERIC_IMAGE_PATTERNS = [
  'yahoo_finance_en-US',
  'whirlpooldata/image/upload',
  'logo',
  'favicon',
  'default_image',
]

function isRealImage(url: string | null | undefined): boolean {
  if (!url) return false
  return !GENERIC_IMAGE_PATTERNS.some(p => url.toLowerCase().includes(p.toLowerCase()))
}

export default function NewsCard({ item }: NewsCardProps) {
  const analysis = item.analysis
  const classification = analysis?.classification
  const rawImageUrl = item.image_url || (item as any).urlToImage
  const imageUrl = isRealImage(rawImageUrl) ? rawImageUrl : null

  return (
    <article className="group bg-surface-container-lowest dark:bg-slate-800 rounded-2xl p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 dark:hover:shadow-violet-900/10 border-l-4 border-primary dark:border-violet-500">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-4 min-w-0">
          {/* Source + Time */}
          <div className="flex items-center gap-3 text-xs font-bold text-on-surface-variant dark:text-slate-400 uppercase tracking-widest flex-wrap">
            <span className="text-primary dark:text-violet-400">{item.source}</span>
            <span className="w-1 h-1 bg-outline-variant rounded-full" />
            <span>{timeAgo(item.published_at)}</span>
            {item.analysis_status === 'completed' && (
              <>
                <span className="w-1 h-1 bg-outline-variant rounded-full" />
                <span className="text-tertiary dark:text-emerald-400">AI已分析</span>
              </>
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold font-headline leading-tight dark:text-slate-100">
            {item.title}
          </h2>

          {/* Chinese title translation */}
          {analysis?.title_zh && analysis.title_zh !== item.title && (
            <p className="text-sm text-on-surface-variant dark:text-slate-400 border-l-2 border-violet-300/40 dark:border-violet-600/40 pl-3">
              {analysis.title_zh}
            </p>
          )}

          {/* Summary */}
          {item.summary && (
            <p className="text-on-surface-variant dark:text-slate-400 leading-relaxed text-sm line-clamp-2">
              {item.summary}
            </p>
          )}

          {/* Chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            {classification && (
              <SentimentChip
                classification={classification}
                score={analysis ? Math.round(Math.abs(analysis.overall_sentiment)) : undefined}
              />
            )}
            {analysis?.affected_stocks?.slice(0, 2).map((stock) => (
              <SentimentChip
                key={stock.ticker}
                classification={stock.impact_score > 0 ? 'bullish' : 'bearish'}
                ticker={stock.ticker}
                score={Math.round(Math.abs(stock.impact_score))}
                size="sm"
              />
            ))}
            {analysis?.affected_sectors?.slice(0, 2).map((sector) => (
              <div
                key={sector}
                className="flex items-center gap-1.5 bg-surface-container-high dark:bg-slate-700 text-on-surface-variant dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold"
              >
                <span className="material-symbols-outlined text-[14px]">token</span>
                {sector}
              </div>
            ))}
          </div>

          {/* Analysis excerpt (Chinese) */}
          {analysis?.headline_summary && (
            <p className="text-xs text-on-surface-variant dark:text-slate-500 italic border-l-2 border-primary/20 pl-3">
              {analysis.headline_summary}
            </p>
          )}
        </div>

        {/* Image */}
        {imageUrl && (
          <div className="w-full md:w-48 flex-shrink-0">
            <div className="w-full h-32 rounded-xl overflow-hidden">
              <NewsImage
                src={imageUrl}
                alt={item.title}
                className="w-full h-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer - status only */}
      {(item.analysis_status === 'pending' || item.analysis_status === 'processing') && (
        <div className="mt-4 pt-4 border-t border-slate-100/50 dark:border-slate-700/50">
          {item.analysis_status === 'pending' && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              等待分析
            </span>
          )}
          {item.analysis_status === 'processing' && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              分析中...
            </span>
          )}
        </div>
      )}
    </article>
  )
}
