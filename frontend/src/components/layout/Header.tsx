import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'

export default function Header() {
  const { toggle } = useTheme()
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <header className="bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-2xl sticky top-0 z-50 shadow-xl shadow-slate-900/5">
      <div className="flex items-center justify-between w-full px-6 py-4 max-w-[1920px] mx-auto">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-2xl font-extrabold tracking-tighter text-slate-900 dark:text-slate-50 font-headline">
            MacroLens
          </Link>
          <nav className="hidden md:flex gap-6 items-center">
            <Link
              to="/analysis"
              className={`font-headline font-semibold tracking-tight transition-colors ${
                isActive('/analysis')
                  ? 'text-violet-700 dark:text-violet-400 font-bold border-b-2 border-violet-700 dark:border-violet-400 pb-1'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              分析
            </Link>
            <Link
              to="/"
              className={`font-headline font-semibold tracking-tight transition-colors ${
                isActive('/')
                  ? 'text-violet-700 dark:text-violet-400 font-bold border-b-2 border-violet-700 dark:border-violet-400 pb-1'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              获取新闻
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/sentiment"
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-lg transition-all duration-300"
            title="市场情绪"
          >
            <span className="material-symbols-outlined">monitoring</span>
          </Link>
          <button
            onClick={toggle}
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-lg transition-all duration-300"
            title="切换主题"
          >
            <span className="material-symbols-outlined dark:hidden">dark_mode</span>
            <span className="material-symbols-outlined hidden dark:inline">light_mode</span>
          </button>
        </div>
      </div>
      <div className="bg-slate-200/40 dark:bg-slate-800/40 h-px w-full" />
    </header>
  )
}
