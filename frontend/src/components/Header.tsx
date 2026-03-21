import type { AnalysisStats } from '../types'
import ThemeToggle from './ThemeToggle'

interface Props {
  stats: AnalysisStats | null | undefined
  onFetch: () => void
  onAnalyze: () => void
  onSettings: () => void
}

export default function Header({ stats, onFetch, onAnalyze, onSettings }: Props) {
  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-xl header-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">M</div>
            <div>
              <h1 className="text-sm font-semibold leading-none">MacroLens</h1>
              <p className="text-[10px] text-muted-more leading-none mt-0.5">宏观新闻情绪分析</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <StatPill label="已分析" value={stats?.total_analyzed ?? 0} />
            <StatPill label="看多" value={stats?.bullish_count ?? 0} color="text-emerald-500" />
            <StatPill label="看空" value={stats?.bearish_count ?? 0} color="text-rose-500" />
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={onFetch}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 hover:-translate-y-0.5 transition-all duration-200">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              获取新闻
            </button>
            <button onClick={onAnalyze}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5 transition-all duration-200 active:scale-95">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              触发分析
            </button>
            <ThemeToggle />
            <button onClick={onSettings} className="p-2 rounded-xl hover-surface transition-all duration-200 text-muted">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </div>
      </header>
      <div className="h-1 gradient-accent" />
    </>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs pill-bg px-2.5 py-1 rounded-full">
      <span className="text-muted-more">{label}</span>
      <span className={`font-mono font-semibold ${color ?? ''}`}>{value}</span>
    </div>
  )
}
