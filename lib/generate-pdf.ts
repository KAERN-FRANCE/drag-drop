import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface PDFAnalysisData {
  driverName: string
  period: string
  score: number
  uploadDate: string
  infractions: {
    date: string
    type: string
    severity: string
  }[]
}

const severityLabels: Record<string, string> = {
  critical: "5ème classe / Délit",
  high: "4ème classe",
  medium: "3ème classe",
  low: "Mineure",
}

const severityCosts: Record<string, number> = {
  critical: 1500,
  high: 750,
  medium: 135,
  low: 90,
}

export function generateAnalysisPDF(data: PDFAnalysisData) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(30, 41, 59) // slate-800
  doc.rect(0, 0, pageWidth, 40, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text("Rapport d'analyse tachygraphe", 20, 18)

  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(`Chauffeur : ${data.driverName}`, 20, 28)
  doc.text(`Période : ${data.period}`, 20, 35)

  doc.setFontSize(11)
  doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`, pageWidth - 20, 28, { align: "right" })

  // Score section
  let y = 55

  doc.setTextColor(30, 41, 59)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("Résumé", 20, y)
  y += 10

  // Score box
  const scoreColor = data.score >= 80 ? [16, 185, 129] : data.score >= 60 ? [245, 158, 11] : [239, 68, 68]
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2])
  doc.roundedRect(20, y, 50, 25, 3, 3, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text(`${data.score}/100`, 45, y + 16, { align: "center" })

  // Stats next to score
  doc.setTextColor(71, 85, 105) // slate-500
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")

  const totalInfractions = data.infractions.length
  let totalCost = 0
  const severityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  data.infractions.forEach(inf => {
    totalCost += severityCosts[inf.severity] || 90
    severityCounts[inf.severity] = (severityCounts[inf.severity] || 0) + 1
  })

  doc.text(`Infractions détectées : ${totalInfractions}`, 80, y + 8)
  doc.text(`Coût potentiel en cas de contrôle : ${totalCost.toLocaleString()}€`, 80, y + 16)
  doc.text(`Date d'upload : ${data.uploadDate}`, 80, y + 24)

  y += 40

  // Severity breakdown
  doc.setTextColor(30, 41, 59)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("Répartition par gravité", 20, y)
  y += 8

  const severityRows = Object.entries(severityCounts)
    .filter(([, count]) => count > 0)
    .map(([sev, count]) => [
      severityLabels[sev] || sev,
      count.toString(),
      `${severityCosts[sev]}€`,
      `${(count * severityCosts[sev]).toLocaleString()}€`,
    ])

  if (severityRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Gravité", "Nombre", "Amende unitaire", "Total"]],
      body: severityRows,
      foot: [["Total", totalInfractions.toString(), "", `${totalCost.toLocaleString()}€`]],
      theme: "grid",
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 10 },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: "bold", fontSize: 10 },
      styles: { fontSize: 10, cellPadding: 5 },
      margin: { left: 20, right: 20 },
    })
    y = (doc as any).lastAutoTable.finalY + 15
  }

  // Infractions table
  doc.setTextColor(30, 41, 59)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("Liste des infractions", 20, y)
  y += 8

  if (data.infractions.length > 0) {
    const infRows = data.infractions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(inf => [
        new Date(inf.date).toLocaleDateString("fr-FR"),
        inf.type,
        severityLabels[inf.severity] || inf.severity,
        `${severityCosts[inf.severity] || 90}€`,
      ])

    autoTable(doc, {
      startY: y,
      head: [["Date", "Type d'infraction", "Gravité", "Amende"]],
      body: infRows,
      theme: "striped",
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 40 },
        3: { cellWidth: 25 },
      },
      margin: { left: 20, right: 20 },
    })
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFillColor(241, 245, 249)
    doc.rect(0, pageHeight - 15, pageWidth, 15, "F")
    doc.setTextColor(148, 163, 184)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text("TachoCompliance — Rapport généré automatiquement", 20, pageHeight - 6)
    doc.text(`Page ${i}/${pageCount}`, pageWidth - 20, pageHeight - 6, { align: "right" })
  }

  // Download
  const filename = `rapport-${data.driverName.replace(/\s+/g, "-").toLowerCase()}-${data.period.replace(/\s+/g, "")}.pdf`
  doc.save(filename)
}
