'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-[#0F1117] flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <p className="text-5xl font-bold text-[#EF4444]">Error</p>
        <p className="text-[#E4E7EC] text-lg font-medium">Something went wrong</p>
        <p className="text-[#9BA1B0] text-sm">An unexpected error occurred.</p>
        <button
          onClick={reset}
          className="mt-2 text-sm bg-[#D4A84B] hover:bg-[#c49535] text-black font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
