import { useState, useEffect } from 'react'

function getETComponents(now: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short', month: 'short', day: 'numeric', hour12: false })
  const parts = fmt.formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  const hour = parseInt(get('hour')) || 0
  const minute = parseInt(get('minute')) || 0
  const weekday = get('weekday')
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
  const dateStr = `${weekday} ${get('month')} ${get('day')}`
  const timeStr = `${String(hour).padStart(2, '0')}:${get('minute').padStart(2, '0')}:${get('second').padStart(2, '0')}`
  return { hour, minute, dayOfWeek, dateStr, timeStr }
}

function getMarketStatus(h: number, m: number, dow: number) {
  if (dow === 0 || dow === 6) return { label: '休市', color: 'text-slate-400' }
  const t = h * 60 + m
  if (t >= 570 && t < 960) return { label: '常规交易时段', color: 'text-emerald-500' }
  if (t >= 240 && t < 570) return { label: '盘前', color: 'text-amber-500' }
  if (t >= 960 && t < 1200) return { label: '盘后', color: 'text-amber-500' }
  return { label: '休市', color: 'text-slate-400' }
}

export default function MarketClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const et = getETComponents(now)
  const status = getMarketStatus(et.hour, et.minute, et.dayOfWeek)
  const localTime = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const localDate = now.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })
  const isTrading = status.label === '常规交易时段'

  return (
    <div className="rounded-2xl panel p-5 hover:shadow-lg transition-shadow duration-300">
      <h3 className="text-xs font-semibold text-muted-more uppercase tracking-wide mb-3">市场时间</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-base">🇺🇸</div>
            <div>
              <p className="text-xs text-muted-more">纽约 (ET)</p>
              <p className="font-mono text-sm font-bold">{et.timeStr}</p>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              isTrading ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' :
              status.label === '休市' ? 'pill-bg text-muted' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
            }`}>{status.label}</span>
            {isTrading && <p className="text-[9px] text-muted-more mt-0.5">(不含节假日)</p>}
            <p className="text-[10px] text-muted-more mt-0.5">{et.dateStr}</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t timeline-border pt-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-base">🏠</div>
            <div>
              <p className="text-xs text-muted-more">本地时间</p>
              <p className="font-mono text-sm font-bold">{localTime}</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-more">{localDate}</p>
        </div>
      </div>
    </div>
  )
}
