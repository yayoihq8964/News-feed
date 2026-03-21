interface FearGreedGaugeProps {
  value: number
  label?: string
}

export default function FearGreedGauge({ value, label }: FearGreedGaugeProps) {
  const clampedValue = Math.max(0, Math.min(100, value))
  const circumference = 2 * Math.PI * 70
  const offset = circumference - (clampedValue / 100) * circumference

  const sentimentLabel = label || (
    clampedValue >= 80 ? 'Extreme Greed' :
    clampedValue >= 60 ? 'Greed' :
    clampedValue >= 40 ? 'Neutral' :
    clampedValue >= 20 ? 'Fear' : 'Extreme Fear'
  )

  const color = clampedValue >= 60 ? '#006a28' : clampedValue >= 40 ? '#6a1cf6' : '#b41340'

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative inline-block">
        <svg width="160" height="160" className="transform -rotate-90">
          <circle cx="80" cy="80" r="70" fill="none" stroke="#e6e8ee" strokeWidth="12" />
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-90">
          <span className="text-4xl font-black text-on-surface dark:text-slate-100 tracking-tighter">
            {Math.round(clampedValue)}
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>
            {sentimentLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
