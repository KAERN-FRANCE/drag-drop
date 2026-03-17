"use client"

import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

const presets = [
  { label: "3 mois", months: 3 },
  { label: "6 mois", months: 6 },
  { label: "12 mois", months: 12 },
]

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const applyPreset = (months: number) => {
    const to = new Date()
    const from = new Date()
    from.setMonth(from.getMonth() - months)
    onChange({ from, to })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start text-left font-normal gap-2", !value.from && "text-muted-foreground")}>
          <CalendarIcon className="h-4 w-4" />
          {value.from ? (
            value.to ? (
              <>
                {format(value.from, "dd MMM yyyy", { locale: fr })} – {format(value.to, "dd MMM yyyy", { locale: fr })}
              </>
            ) : (
              format(value.from, "dd MMM yyyy", { locale: fr })
            )
          ) : (
            "Choisir une période"
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex gap-2 p-3 border-b border-border">
          {presets.map((preset) => (
            <Button
              key={preset.months}
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset.months)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <Calendar
          mode="range"
          selected={value}
          onSelect={(range) => { if (range) onChange(range) }}
          numberOfMonths={2}
          locale={fr}
        />
      </PopoverContent>
    </Popover>
  )
}
