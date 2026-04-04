import { ExternalLink } from 'lucide-react'

interface Step {
  text: string
  code?: string
}

interface ConnectCardProps {
  service: string
  description: string
  steps: Step[]
}

export default function ConnectCard({ service, description, steps }: ConnectCardProps) {
  return (
    <div className="bg-[#1A1D27] border border-[#D4A84B]/30 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-[#D4A84B]/10 border border-[#D4A84B]/20 flex items-center justify-center flex-shrink-0">
          <ExternalLink className="w-5 h-5 text-[#D4A84B]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[#E4E7EC] font-semibold">Connect {service}</h3>
          <p className="text-[#9BA1B0] text-sm mt-1">{description}</p>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-[#9BA1B0] uppercase tracking-wide">Setup steps:</p>
            {steps.map((step, i) => (
              <div key={i} className="text-sm text-[#9BA1B0]">
                <span className="text-[#D4A84B] mr-2">{i + 1}.</span>
                {step.text}
                {step.code && (
                  <code className="ml-2 bg-[#0F1117] border border-[#2E3241] rounded px-2 py-0.5 text-xs text-[#E4E7EC]">
                    {step.code}
                  </code>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
