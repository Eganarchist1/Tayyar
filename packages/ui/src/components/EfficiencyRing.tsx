'use client'
import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const EfficiencyRing = ({ score, size = 72 }: { score: number; size?: number }) => {
  const radius = size / 2 - 6
  const circ = 2 * Math.PI * radius
  const dashOffset = circ - (score / 100) * circ
  
  const config = score >= 80 
    ? { color: 'var(--primary-500)', rgb: '14,165,233', glow: 'shadow-[0_0_12px_rgba(14,165,233,0.3)]' }
    : score >= 60 
    ? { color: 'var(--accent-500)',  rgb: '245,158,11',  glow: 'shadow-[0_0_12px_rgba(245,158,11,0.3)]' }
    : { color: '#EF4444', rgb: '239,68,68', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.3)]' }

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0 group" style={{ width: size, height: size }}>
      {/* Background ring glow */}
      <div 
        className={cn("absolute inset-2 rounded-full blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-500", config.glow)} 
        style={{ backgroundColor: `rgba(${config.rgb}, 0.1)` }} 
      />
      
      <svg width={size} height={size} className="-rotate-90 relative z-10 drop-shadow-sm">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="currentColor" className="text-white/5" strokeWidth="6"/>
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={config.color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={dashOffset}
          style={{ 
            transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34,1.56,0.64,1)', 
            filter: `drop-shadow(0 0 4px ${config.color}80)` 
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <span className="font-mono text-sm font-black text-text-primary tabular-nums tracking-tighter">{score}</span>
        <span className="text-[9px] font-bold font-body-ar text-text-tertiary/70 uppercase tracking-tighter leading-none mt-0.5">Efficiency</span>
      </div>
    </div>
  )
}
