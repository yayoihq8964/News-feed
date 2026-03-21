import { Link, useLocation } from 'react-router-dom'

const navItems = [
  { icon: 'show_chart', label: 'Markets', path: '/' },
  { icon: 'psychology', label: 'Sentiment', path: '/sentiment' },
  { icon: 'calendar_today', label: 'Calendar', path: '/analysis' },
  { icon: 'trending_up', label: 'Trending', path: '/' },
  { icon: 'toll', label: 'Commodities', path: '/' },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="hidden lg:flex flex-col gap-4 p-6 w-64 fixed left-0 top-16 h-[calc(100vh-64px)] overflow-y-auto bg-slate-100 dark:bg-slate-900 custom-scrollbar z-40">
      <div className="mb-4">
        <h2 className="text-lg font-black text-violet-700 dark:text-violet-400 font-headline">
          The Oracle
        </h2>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          Macro Intelligence
        </p>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`p-3 flex items-center gap-3 rounded-xl transition-all duration-200 font-headline text-sm font-semibold hover:translate-x-1 ${
                active
                  ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-4">
        <div className="bg-gradient-to-br from-primary to-primary-container p-4 rounded-xl text-white">
          <p className="text-xs font-black mb-1">PRO PLAN</p>
          <p className="text-sm mb-4 opacity-90 leading-relaxed">
            Unlock institutional-grade flow data and analytics.
          </p>
          <button className="bg-white text-primary px-4 py-2 rounded-lg text-xs font-bold w-full active:scale-95 transition-transform hover:bg-opacity-90">
            Upgrade Pro
          </button>
        </div>
      </div>
    </aside>
  )
}
