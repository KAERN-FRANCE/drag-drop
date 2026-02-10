"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ScoreGauge } from "./score-gauge"
import { Calendar, Euro, AlertTriangle } from "lucide-react"

interface AnalysisSummaryProps {
  score: number
  infractions: number
  period: string
  cost: number
}

export function AnalysisSummary({ score, infractions, period, cost }: AnalysisSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <ScoreGauge score={score} size="md" />
          <p className="mt-2 text-sm font-medium text-foreground">Score conformité</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="flex h-[120px] items-center justify-center">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-8 w-8 text-danger" />
              <span className="font-mono text-4xl font-bold text-danger">{infractions}</span>
            </div>
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">Infractions</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="flex h-[120px] items-center justify-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-8 w-8 text-primary" />
              <span className="text-lg font-semibold text-foreground">{period}</span>
            </div>
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">Période analysée</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="flex h-[120px] items-center justify-center">
            <div className="flex items-center gap-2">
              <Euro className="h-8 w-8 text-danger" />
              <span className="font-mono text-2xl font-bold text-danger">{cost.toLocaleString()}€</span>
            </div>
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">Coût potentiel</p>
        </CardContent>
      </Card>
    </div>
  )
}
