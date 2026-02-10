import { cn } from "@/lib/utils"

interface GravityBadgeProps {
  gravity: "3eme" | "4eme" | "5eme" | "delit"
  showAmount?: boolean
}

const gravityConfig = {
  "3eme": {
    label: "3ème classe",
    amount: "135€",
    className: "bg-blue-100 text-blue-800",
  },
  "4eme": {
    label: "4ème classe",
    amount: "135-750€",
    className: "bg-warning/20 text-warning-foreground",
  },
  "5eme": {
    label: "5ème classe",
    amount: "1500€",
    className: "bg-danger/20 text-danger",
  },
  delit: {
    label: "DÉLIT",
    amount: "30000€+",
    className: "bg-danger text-danger-foreground",
  },
}

export function GravityBadge({ gravity, showAmount = false }: GravityBadgeProps) {
  const config = gravityConfig[gravity]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      {config.label}
      {showAmount && <span className="font-mono">({config.amount})</span>}
    </span>
  )
}
