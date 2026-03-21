import { useState } from 'react'
import type { NewsItem } from '../types'

interface Props { item: NewsItem }

const SOURCE_COLORS: Record<string, string> = {
  reuters: '#ff8000', bloomberg: '#7c3aed', cnbc: '#004a97',
  'financial times': '#e5c400', wsj: '#1e293b', marketwatch: '#1dbfb8',
  yahoo: '#6001d2', benzinga: '#00d4ff', finnhub: '#6366f1',
}

function getSourceColor(src: string) {
  const l = src.toLowerCase()
  for (const [k, c] of Object.entries(SOURCE_COLORS)) { if (l.includes(k)) return c }
  return '#6b7280'
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
      item.is_pinned ? 'bg-amber-50/50 dark:bg-amber-500/5 border-l-[3px] border-l-amber-400 pl-3 rounded-r-xl my-1' : ''
    }`} onClick={() => setOpen(o => !o)}>
      <div className="flex-shrink-0 w-16 pt-0.5 text-right">
        {item.is_pinned && <span className="text-[9px] text-amber-500 font-semibold block mb-0.5 animate-pin-glow">📌 置顶</span>}
        <span className="font-mono text-[11px] text-muted-more">{fmtTime(item.published_at)}</span>
      </div>

      <div className="flex-shrink-0 flex flex-col items-center pt-1.5">
        <div className={`w-2 h-2 rounded-full ${item.is_pinned ? 'bg-amber-400 ring-2 ring-amber-400/30' :
          a ? (a.classification === 'bullish' ? 'bg-emerald-500' : a.classification === 'bearish' ? 'bg-rose-500' : 'bg-slate-400')
          : 'bg-slate-300 dark:bg-slate-600'
        }`} />
        <div className="w-px flex-1 bg-slate-100 dark:bg-slate-800 mt-1" />
      </div>

      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: sc }}>
            {item.source.replace(/^finnhub\//, '').slice(0, 12)}
          </span>
          <span className="text-[10px] text-muted-more">{relTime(item.published_at)}</span>
        </div>

        <h3 className="text-sm font-medium leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200">
          {a?.title_zh || item.title}
        </h3>
        {a?.title_zh && <p className="text-[11px] text-muted-more leading-snug mt-0.5">{item.title}</p>}

        {a && !open && stocks.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              a.classification === 'bullish' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
              : a.classification === 'bearish' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
              : 'pill-bg text-muted'
            }`}>
              {a.classification === 'bullish' ? '看多' : a.classification === 'bearish' ? '看空' : '中性'} {a.confidence}%
            </span>
            {[...stocks].sort((x, y) => Math.abs(y.impact_score) - Math.abs(x.impact_score)).slice(0, 4).map(s => (
              <span key={s.ticker} className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                s.impact_score > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
              }`}>
                {s.ticker} {s.impact_score > 0 ? '↑' : '↓'}{Math.abs(s.impact_score)}
              </span>
            ))}
          </div>
        )}

        {!a && (
          <span className={`inline-block mt-1.5 text-[10px] italic ${
            item.analysis_status === 'processing' ? 'text-indigo-400' :
            item.analysis_status === 'failed' ? 'text-rose-400' : 'text-muted-more'
          }`}>
            {item.analysis_status === 'processing' ? '🔄 AI 分析中...' :
             item.analysis_status === 'failed' ? `❌ 分析失败 (已重试${item.analysis_attempts ?? 0}次)` : '⏳ 排队中'}
          </span>
        )}

        {open && a && (
          <div className="mt-3 p-4 rounded-2xl panel-subtle border space-y-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`text-2xl font-mono font-bold ${a.overall_sentiment >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {a.overall_sentiment > 0 ? '+' : ''}{a.overall_sentiment}
              </div>
              <div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  a.classification === 'bullish' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : a.classification === 'bearish' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                  : 'pill-bg text-muted'
                }`}>
                  {a.classification === 'bullish' ? '看多' : a.classification === 'bearish' ? '看空' : '中性'}
                </span>
                <span className="text-[10px] text-muted ml-2">置信度 {a.confidence}%</span>
              </div>
            </div>
            {a.headline_summary && <p className="text-xs text-muted leading-relaxed">{a.headline_summary}</p>}
            {a.logic_chain && (
              <div className="text-xs text-muted bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5 border border-slate-100 dark:border-slate-700/50">
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
                      <span className={`font-mono text-[10px] font-semibold ${s.impact_score > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
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
                    <div key={c.name} className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl px-2 py-1">
                      <span className="text-xs">{c.name}</span>
                      <span className={`font-mono text-[10px] font-semibold ${c.impact_score > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {c.impact_score > 0 ? '+' : ''}{c.impact_score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sectors.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {sectors.map(s => <span key={s} className="text-[10px] text-muted pill-bg rounded-full px-1.5 py-0.5">{s}</span>)}
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t timeline-border">
              <span className="text-[10px] text-muted-more font-mono">{a.llm_provider}/{a.llm_model}</span>
              <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="text-[10px] text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5 transition-colors">原文链接 ↗</a>
            </div>
          </div>
        )}
        {open && !a && item.summary && <p className="mt-2 text-xs text-muted leading-relaxed">{item.summary}</p>}
      </div>
    </div>
  )
}
