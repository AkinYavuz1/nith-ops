'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Globe,
  Activity,
  Bell,
  CreditCard,
} from 'lucide-react'

const mobileNav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/sites', label: 'Sites', icon: Globe },
  { href: '/uptime', label: 'Uptime', icon: Activity },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/billing', label: 'Billing', icon: CreditCard },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1A1D27] border-t border-[#2E3241] z-50">
      <div className="flex">
        {mobileNav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                active ? 'text-[#D4A84B]' : 'text-[#9BA1B0]'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
