import { useMemo } from 'react'
import type { NewsItem } from '../types'
import NewsTimelineItem from './NewsTimelineItem'

interface Props {
  items: NewsItem[]
  loading: boolean
  filter: 'all' | 'bullish' | 'bearish' | 'pending'
  onFilterChange: (f: 'all' | 'bullish' | 'bearish' | 'pending') => void
}

const FILTERS: { key: Props['filter']; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'bullish', label: '看多' },
  { key: 'bearish', label: '看空' },
  { key: 'pending', label: '待分析' },
]

export default function NewsFeed({ items, loading, filter, onFilterChange }: Props) {
  const filtered = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'pending') return items.filter(n => !n.analysis)
    return items.filter(n => n.analysis?.classification === filter)
  }, [items, filter])

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              filter === f.key
                ? 'bg-blue-500 text-white'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="flex-1" />
        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <div className="w-3 h-3 border-2 border-zinc-300 dark:border-zinc-600 border-t-blue-500 rounded-full animate-spin" />
            加载中
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {filtered.length === 0 && !loading && (
          <div className="text-center py-20 text-zinc-400 dark:text-zinc-500 text-sm">
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
