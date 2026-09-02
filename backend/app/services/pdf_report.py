"""
PDF Report Generator — creates exportable incident reports from real event data.
Uses ReportLab for PDF generation.
"""
import os
import io
import logging
from datetime import datetime
from typing import Optional
from ..models.event import DetectionEvent
from ..config import settings

logger = logging.getLogger(__name__)


class PDFReportGenerator:
    """Generates PDF incident reports from real detection event data."""

    @staticmethod
    def generate_event_report(event: DetectionEvent) -> bytes:
        """Generate a PDF report for a single detection event."""
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import inch, cm
            from reportlab.platypus import (
                SimpleDocTemplate, Paragraph, Spacer, Table,
                TableStyle, Image as RLImage, HRFlowable
            )
        except ImportError:
            logger.error("reportlab not installed. Cannot generate PDF reports.")
            return b""

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=A4,
            rightMargin=2 * cm, leftMargin=2 * cm,
            topMargin=2 * cm, bottomMargin=2 * cm
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle', parent=styles['Title'],
            fontSize=24, textColor=colors.HexColor('#14213D'),
            spaceAfter=12
        )
        heading_style = ParagraphStyle(
            'CustomHeading', parent=styles['Heading2'],
            fontSize=14, textColor=colors.HexColor('#14213D'),
            spaceAfter=8
        )
        body_style = styles['Normal']
        amber = colors.HexColor('#FCA311')
        navy = colors.HexColor('#14213D')

        elements = []

        # Header
        elements.append(Paragraph("RoadRepair", title_style))
        elements.append(Paragraph("AI-Powered Urban Intelligence Platform", body_style))
        elements.append(HRFlowable(
            width="100%", thickness=2, color=amber,
            spaceAfter=20, spaceBefore=10
        ))

        # Report title
        event_type_display = event.event_type.value.replace("_", " ").title() if hasattr(event.event_type, 'value') else str(event.event_type)
        elements.append(Paragraph(f"Incident Report: {event_type_display}", heading_style))
        elements.append(Spacer(1, 12))

        # Event details table
        severity_display = event.severity.value.title() if hasattr(event.severity, 'value') else str(event.severity)
        data = [
            ["Field", "Value"],
            ["Event ID", str(event.id)],
            ["Event Type", event_type_display],
            ["Confidence", f"{event.confidence:.1%}"],
            ["Severity", severity_display],
            ["Detected At", event.detected_at.strftime("%Y-%m-%d %H:%M:%S UTC") if event.detected_at else "N/A"],
            ["Latitude", f"{event.latitude:.6f}" if event.latitude else "N/A"],
            ["Longitude", f"{event.longitude:.6f}" if event.longitude else "N/A"],
            ["Location Accuracy", f"{event.location_accuracy:.1f}m" if event.location_accuracy else "N/A"],
            ["Location Source", event.location_source or "N/A"],
            ["Address", event.address or "N/A"],
        ]

        # Add metadata fields
        if event.event_metadata:
            if "plate_text" in event.event_metadata:
                data.append(["License Plate", event.event_metadata["plate_text"]])
                data.append(["OCR Confidence", f"{event.event_metadata.get('ocr_confidence', 0):.1%}"])
            if "description" in event.event_metadata:
                data.append(["Description", event.event_metadata["description"]])
            if "speed" in event.event_metadata:
                data.append(["Estimated Speed", f"{event.event_metadata['speed']:.0f} px/s"])

        table = Table(data, colWidths=[4 * cm, 12 * cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), navy),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F5F5F5')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 20))

        # Evidence image
        if event.evidence_path:
            evidence_full_path = os.path.join(settings.EVIDENCE_DIR, event.evidence_path)
            if os.path.exists(evidence_full_path):
                elements.append(Paragraph("Evidence Image", heading_style))
                try:
                    img = RLImage(evidence_full_path, width=14 * cm, height=10 * cm)
                    img.hAlign = 'CENTER'
                    elements.append(img)
                except Exception as e:
                    elements.append(Paragraph(f"[Evidence image could not be loaded: {e}]", body_style))
                elements.append(Spacer(1, 12))

        # Footer
        elements.append(HRFlowable(
            width="100%", thickness=1, color=amber,
            spaceAfter=10, spaceBefore=20
        ))
        elements.append(Paragraph(
            f"Generated by RoadRepair AI Platform on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            ParagraphStyle('Footer', parent=body_style, fontSize=8, textColor=colors.grey)
        ))
        elements.append(Paragraph(
            "All data in this report is derived from real AI inference on real video/camera input.",
            ParagraphStyle('Footer2', parent=body_style, fontSize=8, textColor=colors.grey)
        ))

        doc.build(elements)
        return buffer.getvalue()

    @staticmethod
    def generate_session_report(session, events: list[DetectionEvent]) -> bytes:
        """Generate a comprehensive PDF report for an entire detection session."""
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import cm
            from reportlab.platypus import (
                SimpleDocTemplate, Paragraph, Spacer, Table,
                TableStyle, HRFlowable
            )
        except ImportError:
            return b""

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
                                rightMargin=2 * cm, leftMargin=2 * cm,
                                topMargin=2 * cm, bottomMargin=2 * cm)

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Title'],
                                      fontSize=24, textColor=colors.HexColor('#14213D'))
        heading_style = ParagraphStyle('Heading', parent=styles['Heading2'],
                                        fontSize=14, textColor=colors.HexColor('#14213D'))
        body_style = styles['Normal']
        amber = colors.HexColor('#FCA311')
        navy = colors.HexColor('#14213D')

        elements = []

        elements.append(Paragraph("RoadRepair — Session Report", title_style))
        elements.append(HRFlowable(width="100%", thickness=2, color=amber, spaceAfter=20))

        # Determine primary event for title
        display_title = session.name or 'Unnamed Session'
        if events:
            # Sort events by severity then confidence
            severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            sorted_events = sorted(events, key=lambda e: (
                severity_order.get(e.severity.value if hasattr(e.severity, 'value') else e.severity, 99),
                -e.confidence
            ))
            primary_event = sorted_events[0]
            event_type = primary_event.event_type.value if hasattr(primary_event.event_type, 'value') else primary_event.event_type
            display_title = f"{event_type.replace('_', ' ').title()}"

        # Session info
        elements.append(Paragraph(f"Session: {display_title}", heading_style))
        session_data = [
            ["Field", "Value"],
            ["Session ID", str(session.id)],
            ["Source Type", session.source_type.value if hasattr(session.source_type, 'value') else str(session.source_type)],
            ["Status", session.status.value if hasattr(session.status, 'value') else str(session.status)],
            ["Started", session.started_at.strftime("%Y-%m-%d %H:%M:%S") if session.started_at else "N/A"],
            ["Ended", session.ended_at.strftime("%Y-%m-%d %H:%M:%S") if session.ended_at else "Ongoing"],
            ["Total Detections", str(session.total_detections)],
            ["Frames Processed", str(session.total_frames_processed)],
        ]
        table = Table(session_data, colWidths=[4 * cm, 12 * cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), navy),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 20))

        # Events summary
        elements.append(Paragraph(f"Detection Events ({len(events)} total)", heading_style))
        if events:
            event_rows = [["#", "Type", "Confidence", "Severity", "Time", "Location"]]
            for i, evt in enumerate(events[:50], 1):  # Limit to 50 for PDF
                evt_type = evt.event_type.value.replace("_", " ").title() if hasattr(evt.event_type, 'value') else str(evt.event_type)
                sev = evt.severity.value.title() if hasattr(evt.severity, 'value') else str(evt.severity)
                time_str = evt.detected_at.strftime("%H:%M:%S") if evt.detected_at else "N/A"
                loc_str = f"{evt.latitude:.4f}, {evt.longitude:.4f}" if evt.latitude else "N/A"
                event_rows.append([str(i), evt_type, f"{evt.confidence:.1%}", sev, time_str, loc_str])

            evt_table = Table(event_rows, colWidths=[1 * cm, 3.5 * cm, 2.5 * cm, 2 * cm, 2.5 * cm, 4.5 * cm])
            evt_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), navy),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(evt_table)
        else:
            elements.append(Paragraph("No detection events recorded in this session.", body_style))

        elements.append(Spacer(1, 20))
        elements.append(HRFlowable(width="100%", thickness=1, color=amber, spaceBefore=20))
        elements.append(Paragraph(
            f"Generated by RoadRepair AI Platform on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            ParagraphStyle('Footer', parent=body_style, fontSize=8, textColor=colors.grey)
        ))

        doc.build(elements)
        return buffer.getvalue()
