'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Globe,
  Activity,
  BarChart3,
  Bell,
  Users,
  CreditCard,
  Clock,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/sites', label: 'Sites', icon: Globe },
  { href: '/uptime', label: 'Uptime', icon: Activity },
  { href: '/traffic', label: 'Traffic', icon: BarChart3 },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/activity', label: 'Activity', icon: Clock },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside
      className={`hidden md:flex flex-col bg-[#1A1D27] border-r border-[#2E3241] transition-all duration-200 flex-shrink-0 ${
        collapsed ? 'w-16' : 'w-[220px]'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 p-4 border-b border-[#2E3241] ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-[#D4A84B] flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
          N
        </div>
        {!collapsed && (
          <div>
            <div className="text-[#E4E7EC] font-semibold text-sm leading-tight">Nith Ops</div>
            <div className="text-[#9BA1B0] text-xs">Dashboard</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-[#252836] text-[#E4E7EC]'
                  : 'text-[#9BA1B0] hover:text-[#E4E7EC] hover:bg-[#252836]'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[#2E3241] p-3 space-y-1">
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-[#9BA1B0] hover:text-[#EF4444] hover:bg-[#252836] transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-[#9BA1B0] hover:text-[#E4E7EC] hover:bg-[#252836] transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 flex-shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
