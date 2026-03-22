import type { ReactNode } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950 text-on-surface dark:text-slate-100">
      <Header />
      <div className="flex">
        <Sidebar />
        <div className="flex-1 lg:ml-64 pb-16 lg:pb-0 min-w-0">
          {children}
        </div>
      </div>
      <MobileNav />
    </div>
  )
}
