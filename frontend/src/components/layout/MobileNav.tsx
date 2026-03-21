import { Link, useLocation } from 'react-router-dom'

const items = [
  { icon: 'newspaper', label: 'News', path: '/' },
  { icon: 'monitoring', label: 'Sentiment', path: '/sentiment' },
  { icon: 'auto_awesome', label: 'Analysis', path: '/analysis' },
]

export default function MobileNav() {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 h-16 flex items-center justify-around px-4 z-50">
      {items.map((item) => {
        const active = isActive(item.path)
        return (
          <Link
            key={item.label}
            to={item.path}
            className={`flex flex-col items-center gap-1 transition-colors ${
              active
                ? 'text-violet-700 dark:text-violet-400'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
            <span className="text-[10px] font-bold">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
