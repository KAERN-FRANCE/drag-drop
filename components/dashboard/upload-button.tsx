"use client"

import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function UploadButton() {
  return (
    <Link href="/upload">
      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 gap-2 rounded-full px-6 shadow-lg transition-transform hover:scale-105"
      >
        <Upload className="h-5 w-5" />
        Uploader un fichier
      </Button>
    </Link>
  )
}
