import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '404 Not Found' }

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0F1117] flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <p className="text-5xl font-bold text-[#D4A84B]">404</p>
        <p className="text-[#E4E7EC] text-lg font-medium">Page not found</p>
        <p className="text-[#9BA1B0] text-sm">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/"
          className="inline-block mt-2 text-sm text-[#3B82F6] hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
