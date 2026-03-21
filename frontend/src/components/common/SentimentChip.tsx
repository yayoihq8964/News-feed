interface SentimentChipProps {
  classification: 'bullish' | 'bearish' | 'neutral'
  ticker?: string
  score?: number
  size?: 'sm' | 'md'
}

export default function SentimentChip({ classification, ticker, score, size = 'md' }: SentimentChipProps) {
  const isBullish = classification === 'bullish'
  const isBearish = classification === 'bearish'

  const colorClass = isBullish
    ? 'bg-tertiary-container text-on-tertiary-container'
    : isBearish
    ? 'bg-error-container text-on-error-container'
    : 'bg-surface-container-high text-on-surface-variant dark:bg-slate-700 dark:text-slate-300'

  const icon = isBullish ? 'trending_up' : isBearish ? 'trending_down' : 'trending_flat'

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${colorClass}`}>
      <span className={`material-symbols-outlined ${size === 'sm' ? 'text-[14px]' : 'text-[16px]'}`}>
        {icon}
      </span>
      {ticker && <span>{ticker}</span>}
      {score !== undefined && (
        <span className="opacity-60 font-medium">
          {ticker ? '| ' : ''}{classification.charAt(0).toUpperCase() + classification.slice(1)} ({score})
        </span>
      )}
      {!ticker && !score && (
        <span>{classification.charAt(0).toUpperCase() + classification.slice(1)}</span>
      )}
    </div>
  )
}
