import { useState } from 'react'
import type { NewsItem } from '../types'

interface Props { item: NewsItem }

const SOURCE_COLORS: Record<string, string> = {
  reuters: '#d4824a', bloomberg: '#7c6aad', cnbc: '#3a7a6a',
  'financial times': '#c4a840', wsj: '#3f4f3a', marketwatch: '#2a9a8a',
  yahoo: '#7a5aaa', benzinga: '#3a8aaa', finnhub: '#7fa850',
}

function getSourceColor(src: string) {
  const l = src.toLowerCase()
  for (const [k, c] of Object.entries(SOURCE_COLORS)) { if (l.includes(k)) return c }
  return '#8c7e72'
}

function ensureUTC(s: string): string {
  if (s && !s.endsWith('Z') && !s.includes('+')) return s + 'Z'
  return s
}

function fmtTime(s: string): string {
  try { return new Date(ensureUTC(s)).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) }
  catch { return '--:--:--' }
}

function relTime(s: string): string {
  const d = Math.floor((Date.now() - new Date(ensureUTC(s)).getTime()) / 1000)
  if (d < 0) return '刚刚'
  if (d < 60) return `${d}秒前`
  if (d < 3600) return `${Math.floor(d / 60)}分钟前`
  if (d < 86400) return `${Math.floor(d / 3600)}小时前`
  return `${Math.floor(d / 86400)}天前`
}

export default function NewsTimelineItem({ item }: Props) {
  const [open, setOpen] = useState(false)
  const a = item.analysis
  const sc = getSourceColor(item.source)
  const stocks = a?.affected_stocks ?? []
  const commodities = a?.affected_commodities ?? []
  const sectors = a?.affected_sectors ?? []

  return (
    <div className={`relative flex gap-4 py-3.5 border-b timeline-border cursor-pointer group ${
      item.is_pinned
        ? 'bg-[#f4f8ef] dark:bg-leaf-700/[0.06] border-l-[3px] border-l-leaf-500 pl-3 shadow-[0_2px_12px_rgba(127,168,80,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] rounded-r-[1.5rem] my-1'
        : ''
    }`}
      onClick={() => setOpen(o => !o)}>
      {/* Time */}
      <div className="flex-shrink-0 w-16 pt-0.5 text-right">
        {item.is_pinned && <span className="text-[9px] text-leaf-600 dark:text-leaf-400 font-semibold block mb-0.5 animate-pin-pulse">📌 置顶</span>}
        <span className="font-mono text-[11px] text-muted-more">{fmtTime(item.published_at)}</span>
      </div>

      {/* Dot */}
      <div className="flex-shrink-0 flex flex-col items-center pt-1.5">
        <div className={`w-2 h-2 rounded-full ${item.is_pinned ? 'bg-leaf-500 ring-2 ring-leaf-500/20' :
          a ? (a.classification === 'bullish' ? 'bg-leaf-500' : a.classification === 'bearish' ? 'bg-coral-500' : 'bg-earth-300')
          : 'bg-paper-300 dark:bg-moss-400'
        }`} />
        <div className="w-px flex-1 mt-1" style={{ background: 'rgba(220,220,208,0.4)' }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: sc }}>
            {item.source.replace(/^finnhub\//, '').slice(0, 12)}
          </span>
          <span className="text-[10px] text-muted-more">{relTime(item.published_at)}</span>
        </div>

        <h3 className="text-sm font-medium leading-snug group-hover:text-leaf-700 dark:group-hover:text-leaf-400 transition-colors duration-200">
          {a?.title_zh || item.title}
        </h3>
        {a?.title_zh && (
          <p className="text-[11px] text-muted-more leading-snug mt-0.5">{item.title}</p>
        )}

        {/* Collapsed: ticker pills */}
        {a && !open && stocks.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              a.classification === 'bullish' ? 'bg-leaf-50 text-leaf-700 dark:bg-leaf-700/20 dark:text-leaf-400'
              : a.classification === 'bearish' ? 'bg-coral-100 text-coral-600 dark:bg-coral-600/15 dark:text-coral-400'
              : 'pill-bg text-muted'
            }`}>
              {a.classification === 'bullish' ? '看多' : a.classification === 'bearish' ? '看空' : '中性'} {a.confidence}%
            </span>
            {[...stocks].sort((x, y) => Math.abs(y.impact_score) - Math.abs(x.impact_score)).slice(0, 4).map(s => (
              <span key={s.ticker} className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                s.impact_score > 0 ? 'bg-leaf-50 text-leaf-700 dark:bg-leaf-700/20 dark:text-leaf-400'
                : 'bg-coral-100 text-coral-600 dark:bg-coral-600/15 dark:text-coral-400'
              }`}>
                {s.ticker} {s.impact_score > 0 ? '↑' : '↓'}{Math.abs(s.impact_score)}
              </span>
            ))}
          </div>
        )}

        {/* Status for unanalyzed */}
        {!a && (
          <span className={`inline-block mt-1.5 text-[10px] italic ${
            item.analysis_status === 'processing' ? 'text-leaf-400' :
            item.analysis_status === 'failed' ? 'text-coral-400' :
            'text-muted-more'
          }`}>
            {item.analysis_status === 'processing' ? '🔄 AI 分析中...' :
             item.analysis_status === 'failed' ? `❌ 分析失败 (已重试${item.analysis_attempts ?? 0}次)` :
             `⏳ 排队中`}
          </span>
        )}

        {/* Expanded */}
        {open && a && (
          <div className="mt-3 p-5 rounded-[1.5rem] panel-subtle space-y-3" style={{ border: '1px solid rgba(220,220,208,0.4)', boxShadow: '0 2px 12px rgba(63,79,58,0.05)' }}>
            <div className="flex items-center gap-3">
              <div className={`text-2xl font-mono font-bold ${a.overall_sentiment >= 0 ? 'text-leaf-600 dark:text-leaf-400' : 'text-coral-500 dark:text-coral-400'}`}>
                {a.overall_sentiment > 0 ? '+' : ''}{a.overall_sentiment}
              </div>
              <div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  a.classification === 'bullish' ? 'bg-leaf-50 text-leaf-700 dark:bg-leaf-700/20 dark:text-leaf-400'
                  : a.classification === 'bearish' ? 'bg-coral-100 text-coral-600 dark:bg-coral-600/15 dark:text-coral-400'
                  : 'pill-bg text-muted'
                }`}>
                  {a.classification === 'bullish' ? '看多' : a.classification === 'bearish' ? '看空' : '中性'}
                </span>
                <span className="text-[10px] text-muted ml-2">置信度 {a.confidence}%</span>
              </div>
            </div>

            {a.headline_summary && <p className="text-xs text-muted leading-relaxed">{a.headline_summary}</p>}

            {a.logic_chain && (
              <div className="text-xs text-muted rounded-xl p-3" style={{ background: 'rgba(237,242,230,0.5)', border: '1px solid rgba(220,220,208,0.35)' }}>
                <span className="text-muted-more mr-1">推理链:</span>{a.logic_chain}
              </div>
            )}

            {stocks.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-more uppercase tracking-wide mb-1.5">影响个股</p>
                <div className="flex flex-wrap gap-1.5">
                  {[...stocks].sort((x, y) => Math.abs(y.impact_score) - Math.abs(x.impact_score)).map(s => (
                    <div key={s.ticker} className="flex items-center gap-1 panel rounded-xl px-2 py-1">
                      <span className="font-mono text-xs font-bold">{s.ticker}</span>
                      <span className={`font-mono text-[10px] font-semibold ${s.impact_score > 0 ? 'text-leaf-600 dark:text-leaf-400' : 'text-coral-500 dark:text-coral-400'}`}>
                        {s.impact_score > 0 ? '+' : ''}{s.impact_score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {commodities.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-more uppercase tracking-wide mb-1.5">贵金属</p>
                <div className="flex flex-wrap gap-1.5">
                  {commodities.map(c => (
                    <div key={c.name} className="flex items-center gap-1 rounded-xl px-2 py-1" style={{ background: 'rgba(237,242,230,0.5)', border: '1px solid rgba(220,220,208,0.35)' }}>
                      <span className="text-xs">{c.name}</span>
                      <span className={`font-mono text-[10px] font-semibold ${c.impact_score > 0 ? 'text-leaf-600 dark:text-leaf-400' : 'text-coral-500 dark:text-coral-400'}`}>
                        {c.impact_score > 0 ? '+' : ''}{c.impact_score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sectors.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {sectors.map(s => (
                  <span key={s} className="text-[10px] text-muted pill-bg rounded-full px-1.5 py-0.5">{s}</span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t timeline-border">
              <span className="text-[10px] text-muted-more font-mono">{a.llm_provider}/{a.llm_model}</span>
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[10px] text-leaf-600 hover:text-leaf-700 dark:text-leaf-400 dark:hover:text-leaf-300 flex items-center gap-0.5 transition-colors duration-200">
                原文链接 ↗
              </a>
            </div>
          </div>
        )}

        {open && !a && item.summary && (
          <p className="mt-2 text-xs text-muted leading-relaxed">{item.summary}</p>
        )}
      </div>
    </div>
  )
}
