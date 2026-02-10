"""Routes pour la génération de rapports PDF."""

import io
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from database.db import (
    get_connection,
    get_driver_by_id,
    get_infringements_by_driver,
)

router = APIRouter()

SEVERITY_COLORS = {
    "MI": colors.HexColor("#FFC107"),   # Jaune
    "SI": colors.HexColor("#FF9800"),   # Orange
    "VSI": colors.HexColor("#F44336"),  # Rouge
    "MSI": colors.HexColor("#9C27B0"),  # Violet
}


@router.get("/report/{driver_id}/pdf")
def generate_pdf_report(driver_id: int):
    """Génère un rapport PDF des infractions d'un conducteur."""
    with get_connection() as conn:
        driver = get_driver_by_id(conn, driver_id)
        if not driver:
            raise HTTPException(status_code=404, detail="Conducteur non trouvé")

        infringements = get_infringements_by_driver(conn, driver_id)

    # Générer le PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    elements = []

    # Titre
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontSize=18,
        spaceAfter=20,
    )
    elements.append(Paragraph("Rapport d'infractions tachygraphiques", title_style))
    elements.append(Spacer(1, 10))

    # Infos conducteur
    info_style = ParagraphStyle("Info", parent=styles["Normal"], fontSize=11, spaceAfter=5)
    elements.append(Paragraph(f"<b>Conducteur :</b> {driver['driver_name']}", info_style))
    elements.append(Paragraph(f"<b>N° carte :</b> {driver['card_number']}", info_style))
    elements.append(Paragraph(
        f"<b>Date du rapport :</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}",
        info_style,
    ))
    elements.append(Paragraph(
        f"<b>Total infractions :</b> {len(infringements)}",
        info_style,
    ))
    elements.append(Spacer(1, 20))

    # Résumé par gravité
    severity_counts = {"MI": 0, "SI": 0, "VSI": 0, "MSI": 0}
    for inf in infringements:
        sev = inf.get("severity", "MI")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    summary_data = [
        ["Gravité", "Nombre", "Description"],
        ["MI", str(severity_counts["MI"]), "Infraction mineure"],
        ["SI", str(severity_counts["SI"]), "Infraction grave"],
        ["VSI", str(severity_counts["VSI"]), "Infraction très grave"],
        ["MSI", str(severity_counts["MSI"]), "Infraction la plus grave"],
    ]

    summary_table = Table(summary_data, colWidths=[3 * cm, 3 * cm, 8 * cm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#333333")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F5F5")]),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 20))

    # Tableau des infractions
    if infringements:
        elements.append(Paragraph("<b>Détail des infractions</b>", styles["Heading2"]))
        elements.append(Spacer(1, 10))

        table_data = [["Date", "Article", "Description", "Gravité", "Valeur", "Limite", "Excès"]]

        for inf in infringements:
            table_data.append([
                inf.get("infringement_date", ""),
                inf.get("article", ""),
                inf.get("rule_description", "")[:40],
                inf.get("severity", ""),
                f"{inf.get('value', 0):.1f}h",
                f"{inf.get('limit_value', 0):.1f}h",
                f"{inf.get('excess', 0):.1f}h",
            ])

        inf_table = Table(
            table_data,
            colWidths=[2.2 * cm, 1.8 * cm, 5 * cm, 1.5 * cm, 1.8 * cm, 1.8 * cm, 1.8 * cm],
        )

        # Style avec couleurs de gravité par ligne
        table_style = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#333333")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]

        for i, inf in enumerate(infringements, start=1):
            sev = inf.get("severity", "MI")
            color = SEVERITY_COLORS.get(sev, colors.white)
            table_style.append(("BACKGROUND", (3, i), (3, i), color))

        inf_table.setStyle(TableStyle(table_style))
        elements.append(inf_table)
    else:
        elements.append(Paragraph("Aucune infraction détectée.", styles["Normal"]))

    # Footer
    elements.append(Spacer(1, 30))
    footer_style = ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=colors.grey)
    elements.append(Paragraph(
        "Rapport généré automatiquement — Règlement (CE) 561/2006 — Directive 2009/5/CE",
        footer_style,
    ))

    doc.build(elements)
    buffer.seek(0)

    filename = f"rapport_{driver['card_number']}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
