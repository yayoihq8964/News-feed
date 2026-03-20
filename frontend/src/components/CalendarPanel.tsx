import { useState } from 'react'
import type { CalendarEvent } from '../types'
import { analyzeCalendar } from '../services/api'

interface Props {
  events: CalendarEvent[]
  loading: boolean
  onEventsUpdate?: (events: CalendarEvent[]) => void
}

function fmtEventTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  } catch { return dateStr }
}

function isUpcoming(dateStr: string): boolean {
  try { return new Date(dateStr).getTime() > Date.now() } catch { return false }
}

function isPast(dateStr: string): boolean {
  try { return new Date(dateStr).getTime() <= Date.now() } catch { return true }
}

function ImpactBadge({ impact, label }: { impact?: string; label: string }) {
  if (!impact) return null
  const map: Record<string, { emoji: string; text: string; cls: string }> = {
    bullish: { emoji: '🟢', text: '利多', cls: 'text-emerald-500' },
    bearish: { emoji: '🔴', text: '利空', cls: 'text-red-500' },
    neutral: { emoji: '⚪', text: '中性', cls: 'text-zinc-400' },
  }
  const style = map[impact] ?? map.neutral
  return (
    <span className={`text-[9px] font-semibold ${style.cls}`}>
      {label}:{style.emoji}{style.text}
    </span>
  )
}

export default function CalendarPanel({ events, loading, onEventsUpdate }: Props) {
  const [analyzing, setAnalyzing] = useState(false)
  const [localEvents, setLocalEvents] = useState<CalendarEvent[] | null>(null)

  const displayEvents = localEvents ?? events
  const upcoming = displayEvents.filter(e => isUpcoming(e.date)).slice(0, 8)
  const recent = displayEvents.filter(e => isPast(e.date) && e.actual).slice(-4).reverse()

  const hasAnalysis = displayEvents.some(e => e.stock_impact)

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const result = await analyzeCalendar()
      setLocalEvents(result.events)
      onEventsUpdate?.(result.events)
    } catch (err) {
      console.error('Calendar analysis failed', err)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="rounded-xl border panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-more uppercase tracking-wide">📅 宏观经济日历</h3>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
        >
          {analyzing ? '分析中...' : hasAnalysis ? '重新分析' : 'AI分析'}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted text-center py-4">加载中...</p>
      ) : displayEvents.length === 0 ? (
        <p className="text-xs text-muted text-center py-4">暂无数据</p>
      ) : (
        <div className="space-y-3">
          {/* Recent with actual data */}
          {recent.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-more uppercase mb-1.5">已公布</p>
              {recent.map((e, i) => (
                <EventRow key={`r-${i}`} event={e} variant="past" />
              ))}
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-more uppercase mb-1.5">即将公布</p>
              {upcoming.map((e, i) => (
                <EventRow key={`u-${i}`} event={e} variant="upcoming" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EventRow({ event: e, variant }: { event: CalendarEvent; variant: 'past' | 'upcoming' }) {
  const impactColor = e.impact === 'High' ? 'text-red-500' : 'text-amber-500'
  const hasAi = !!e.stock_impact

  return (
    <div className="flex items-start gap-2 py-1.5 border-b timeline-border last:border-0">
      <div className="flex-shrink-0 w-14">
        <span className="font-mono text-[10px] text-muted-more">{fmtEventTime(e.date)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px]">{e.country.split(' ')[0]}</span>
          <span className="text-xs leading-snug truncate">{e.title_zh || e.title}</span>
          <span className={`text-[9px] font-semibold ${impactColor}`}>{e.impact_zh}</span>
        </div>
        {hasAi && (
          <div className="flex gap-2 mt-0.5 flex-wrap">
            <ImpactBadge impact={e.stock_impact} label="股" />
            <ImpactBadge impact={e.commodity_impact} label="商" />
          </div>
        )}
        <div className="flex gap-3 mt-0.5 flex-wrap">
          {e.forecast && <span className="text-[10px] text-muted-more">预期: <span className="text-muted">{e.forecast}</span></span>}
          {e.previous && <span className="text-[10px] text-muted-more">前值: <span className="text-muted">{e.previous}</span></span>}
          {variant === 'past' && e.actual && (
            <span className="text-[10px] text-muted-more">实际: <span className="font-semibold text-blue-500">{e.actual}</span></span>
          )}
        </div>
        {hasAi && e.explanation && (
          <p className="text-[10px] text-muted mt-0.5 leading-relaxed">{e.explanation}</p>
        )}
      </div>
    </div>
  )
}
