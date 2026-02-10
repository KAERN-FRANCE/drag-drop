import type React from "react"
import { DriverSidebar } from "@/components/driver/driver-sidebar"

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <DriverSidebar />
      <main className="pl-64">{children}</main>
    </div>
  )
}
