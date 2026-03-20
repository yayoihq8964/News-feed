import { useMemo } from 'react'
import type { NewsItem } from '../types'
import NewsTimelineItem from './NewsTimelineItem'

interface Props {
  items: NewsItem[]
  loading: boolean
  filter: 'all' | 'bullish' | 'bearish'
  onFilterChange: (f: 'all' | 'bullish' | 'bearish') => void
}

const FILTERS: { key: Props['filter']; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'bullish', label: '看多' },
  { key: 'bearish', label: '看空' },
]

export default function NewsFeed({ items, loading, filter, onFilterChange }: Props) {
  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter(n => n.analysis?.classification === filter)
  }, [items, filter])

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 mb-4">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`text-xs font-medium px-3.5 py-1.5 rounded-full transition-all ${
              filter === f.key
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="flex-1" />
        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <div className="w-3 h-3 border-2 border-slate-300 dark:border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
            加载中
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {filtered.length === 0 && !loading && (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500 text-sm">
            暂无新闻数据
          </div>
        )}
        {filtered.map(item => (
          <NewsTimelineItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
