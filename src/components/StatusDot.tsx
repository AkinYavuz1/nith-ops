interface StatusDotProps {
  isUp: boolean
  isChecking?: boolean
  slow?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function StatusDot({ isUp, isChecking, slow, size = 'md' }: StatusDotProps) {
  const sizes = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' }
  const color = isChecking
    ? 'bg-[#3B82F6]'
    : !isUp
    ? 'bg-[#EF4444]'
    : slow
    ? 'bg-[#F59E0B]'
    : 'bg-[#22C55E]'

  return (
    <span
      className={`inline-block rounded-full flex-shrink-0 ${sizes[size]} ${color} ${
        isChecking ? 'pulse-dot' : ''
      }`}
    />
  )
}
