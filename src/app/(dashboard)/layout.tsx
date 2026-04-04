import Sidebar from '@/components/Sidebar'
export const runtime = 'edge'

import MobileNav from '@/components/MobileNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto scrollbar-thin pb-16 md:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
