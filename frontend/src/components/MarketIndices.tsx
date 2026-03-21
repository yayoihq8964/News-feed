import { useState, useEffect, useRef } from 'react'

interface Quote {
  symbol: string
  name: string
  label: string
  price: number | null
  change: number | null
  changePercent: number | null
  previousClose: number | null
}

const INDEX_CONFIG: Record<string, { gradient: string; icon: string }> = {
  '^IXIC': { gradient: 'from-indigo-500 to-purple-600', icon: '📊' },
  '^GSPC': { gradient: 'from-rose-500 to-pink-600', icon: '📈' },
  '^N225': { gradient: 'from-amber-500 to-orange-600', icon: '⛩️' },
  '000001.SS': { gradient: 'from-purple-500 to-fuchsia-600', icon: '🏮' },
}

function formatPrice(price: number | null): string {
  if (price === null) return '--'
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function MarketIndices() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down'>>({})
  const prevPrices = useRef<Record<string, number | null>>({})

  const fetchQuotes = async () => {
    try {
      const res = await fetch('/api/quotes')
      if (!res.ok) return
      const data = await res.json()
      const newQuotes: Quote[] = data.quotes ?? []

      const newFlash: Record<string, 'up' | 'down'> = {}
      for (const q of newQuotes) {
        const prev = prevPrices.current[q.symbol]
        if (prev !== undefined && prev !== null && q.price !== null && q.price !== prev) {
          newFlash[q.symbol] = q.price > prev ? 'up' : 'down'
        }
        prevPrices.current[q.symbol] = q.price
      }

      setQuotes(newQuotes)
      if (Object.keys(newFlash).length > 0) {
        setFlashMap(newFlash)
        setTimeout(() => setFlashMap({}), 900)
      }
    } catch {
      // silently fail — component shows stale data
    }
  }

  useEffect(() => {
    fetchQuotes()
    const interval = setInterval(fetchQuotes, 30000)
    return () => clearInterval(interval)
  }, [])

  if (quotes.length === 0) return null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {quotes.map(q => {
        const config = INDEX_CONFIG[q.symbol] ?? { gradient: 'from-slate-500 to-slate-600', icon: '📉' }
        const isUp = (q.changePercent ?? 0) >= 0
        const flash = flashMap[q.symbol]

        return (
          <div key={q.symbol} className="rounded-2xl panel p-4 hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-base shadow-sm flex-shrink-0`}>
                <span>{config.icon}</span>
              </div>
              {q.changePercent !== null ? (
                <span className={`text-xs font-semibold ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isUp ? '↑' : '↓'} {Math.abs(q.changePercent).toFixed(2)}%
                </span>
              ) : (
                <span className="text-xs text-muted-more">--</span>
              )}
            </div>
            <div className={`rounded-md px-1 -mx-1 ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`}>
              <p className="font-mono text-xl font-bold leading-tight">
                {formatPrice(q.price)}
              </p>
            </div>
            <p className="text-xs text-muted-more mt-1 truncate">{q.name}</p>
          </div>
        )
      })}
    </div>
  )
}
