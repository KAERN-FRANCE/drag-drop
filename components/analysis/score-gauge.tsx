"use client"

import { cn } from "@/lib/utils"

interface ScoreGaugeProps {
  score: number
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
}

export function ScoreGauge({ score, size = "md", showLabel = true }: ScoreGaugeProps) {
  const getColor = (s: number) => {
    if (s >= 90) return { stroke: "#10B981", text: "text-success" }
    if (s >= 70) return { stroke: "#F59E0B", text: "text-warning" }
    return { stroke: "#EF4444", text: "text-danger" }
  }

  const { stroke, text } = getColor(score)

  const sizeConfig = {
    sm: { width: 52, height: 52, strokeWidth: 4, fontSize: "text-sm", labelSize: "text-[8px]", radius: 20 },
    md: { width: 120, height: 120, strokeWidth: 8, fontSize: "text-3xl", labelSize: "text-sm", radius: 48 },
    lg: { width: 180, height: 180, strokeWidth: 10, fontSize: "text-5xl", labelSize: "text-base", radius: 72 },
  }

  const config = sizeConfig[size]
  const circumference = 2 * Math.PI * config.radius
  const progress = ((100 - score) / 100) * circumference

  // For sm size, show score compactly with /100 below
  const showLabelActual = showLabel && size !== "sm"

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: config.width, height: config.height }}>
      <svg width={config.width} height={config.height} className="-rotate-90 transform absolute inset-0">
        {/* Background circle */}
        <circle
          cx={config.width / 2}
          cy={config.height / 2}
          r={config.radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          className="text-muted"
        />
        {/* Progress circle */}
        <circle
          cx={config.width / 2}
          cy={config.height / 2}
          r={config.radius}
          fill="none"
          stroke={stroke}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="flex flex-col items-center justify-center leading-none">
        <span className={cn("font-mono font-bold", config.fontSize, text)}>{score}</span>
        {showLabelActual && <span className={cn("text-muted-foreground mt-0.5", config.labelSize)}>/100</span>}
      </div>
    </div>
  )
}
