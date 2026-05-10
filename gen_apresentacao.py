from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.platypus import PageBreak
from reportlab.pdfgen import canvas as pdfcanvas

NAVY  = colors.HexColor("#0f172a")
BLUE  = colors.HexColor("#0f3460")
RED   = colors.HexColor("#e94560")
SLATE = colors.HexColor("#64748b")
LIGHT = colors.HexColor("#f8fafc")
BORDER= colors.HexColor("#e2e8f0")
GREEN = colors.HexColor("#16a34a")
AMBER = colors.HexColor("#d97706")
VIOLET= colors.HexColor("#7c3aed")

W, H = A4  # 595 x 842 pt

# ── Styles ────────────────────────────────────────────────────────────────────

def make_styles():
    return {
        "title": ParagraphStyle("title",
            fontName="Helvetica-Bold", fontSize=28, leading=34,
            textColor=colors.white, spaceAfter=4*mm),
        "cover_sub": ParagraphStyle("cover_sub",
            fontName="Helvetica", fontSize=11, leading=16,
            textColor=colors.HexColor("#94a3b8"), spaceAfter=8*mm),
        "cover_tag": ParagraphStyle("cover_tag",
            fontName="Helvetica-Bold", fontSize=8, leading=10,
            textColor=RED, spaceAfter=4*mm, charSpace=1.5),
        "h1": ParagraphStyle("h1",
            fontName="Helvetica-Bold", fontSize=16, leading=20,
            textColor=NAVY, spaceBefore=6*mm, spaceAfter=2*mm),
        "h2": ParagraphStyle("h2",
            fontName="Helvetica-Bold", fontSize=12, leading=15,
            textColor=BLUE, spaceBefore=5*mm, spaceAfter=1.5*mm),
        "eyebrow": ParagraphStyle("eyebrow",
            fontName="Helvetica-Bold", fontSize=7.5, leading=10,
            textColor=RED, spaceBefore=4*mm, spaceAfter=1*mm, charSpace=1.2),
        "body": ParagraphStyle("body",
            fontName="Helvetica", fontSize=9.5, leading=14,
            textColor=colors.HexColor("#334155"), spaceAfter=2*mm),
        "body_small": ParagraphStyle("body_small",
            fontName="Helvetica", fontSize=8.5, leading=13,
            textColor=SLATE, spaceAfter=1.5*mm),
        "bullet": ParagraphStyle("bullet",
            fontName="Helvetica", fontSize=9.5, leading=14,
            textColor=colors.HexColor("#334155"),
            leftIndent=10, firstLineIndent=-10, spaceAfter=1.5*mm),
        "caption": ParagraphStyle("caption",
            fontName="Helvetica-Oblique", fontSize=8, leading=11,
            textColor=SLATE, spaceAfter=2*mm, alignment=TA_CENTER),
        "footer": ParagraphStyle("footer",
            fontName="Helvetica", fontSize=7.5, leading=10,
            textColor=colors.HexColor("#94a3b8"), alignment=TA_CENTER),
        "th": ParagraphStyle("th",
            fontName="Helvetica-Bold", fontSize=8.5, leading=11,
            textColor=colors.white),
        "td": ParagraphStyle("td",
            fontName="Helvetica", fontSize=8.5, leading=12,
            textColor=colors.HexColor("#1e293b")),
        "td_accent": ParagraphStyle("td_accent",
            fontName="Helvetica-Bold", fontSize=8.5, leading=12,
            textColor=BLUE),
        "note": ParagraphStyle("note",
            fontName="Helvetica", fontSize=8.5, leading=13,
            textColor=colors.HexColor("#1e3a5f"),
            leftIndent=4*mm, rightIndent=4*mm, spaceAfter=3*mm),
        "step_num": ParagraphStyle("step_num",
            fontName="Helvetica-Bold", fontSize=10, leading=12,
            textColor=colors.white, alignment=TA_CENTER),
        "step_label": ParagraphStyle("step_label",
            fontName="Helvetica-Bold", fontSize=9, leading=11,
            textColor=NAVY),
        "step_text": ParagraphStyle("step_text",
            fontName="Helvetica", fontSize=8, leading=12,
            textColor=SLATE),
        "url": ParagraphStyle("url",
            fontName="Helvetica-Bold", fontSize=13, leading=16,
            textColor=RED, alignment=TA_CENTER, spaceAfter=2*mm),
        "end_title": ParagraphStyle("end_title",
            fontName="Helvetica-Bold", fontSize=22, leading=26,
            textColor=colors.white, alignment=TA_CENTER, spaceAfter=3*mm),
        "end_sub": ParagraphStyle("end_sub",
            fontName="Helvetica", fontSize=10, leading=14,
            textColor=colors.HexColor("#94a3b8"), alignment=TA_CENTER, spaceAfter=4*mm),
    }

# ── Canvas callbacks (header/footer per page) ─────────────────────────────────

class NumberedCanvas(pdfcanvas.Canvas):
    def __init__(self, *args, **kwargs):
        pdfcanvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for i, state in enumerate(self._saved_page_states):
            self.__dict__.update(state)
            self.draw_page(i + 1, num_pages)
            pdfcanvas.Canvas.showPage(self)
        pdfcanvas.Canvas.save(self)

    def draw_page(self, page_num, total):
        w, h = A4
        is_cover = (page_num == 1)
        is_end   = (page_num == total)

        if is_cover or is_end:
            # Full dark background
            self.setFillColor(NAVY)
            self.rect(0, 0, w, h, fill=1, stroke=0)
            # Red bottom bar
            self.setFillColor(RED)
            self.rect(0, 0, w, 3, fill=1, stroke=0)
            # Dot pattern (top-right)
            self.setFillColor(colors.white)
            self.setFillAlpha(0.07)
            for row in range(8):
                for col in range(10):
                    cx = w - 50*mm + col * 5*mm
                    cy = h - 20*mm - row * 5*mm
                    if 0 < cx < w and 0 < cy < h:
                        self.circle(cx, cy, 1.2, fill=1, stroke=0)
            self.setFillAlpha(1)
        else:
            # White page — light header bar
            self.setFillColor(colors.white)
            self.rect(0, 0, w, h, fill=1, stroke=0)
            # Top accent line
            self.setFillColor(BLUE)
            self.rect(0, h - 2, w, 2, fill=1, stroke=0)
            # Header bar
            self.setFillColor(colors.HexColor("#f8fafc"))
            self.rect(0, h - 14*mm, w, 12*mm, fill=1, stroke=0)
            self.setStrokeColor(BORDER)
            self.setLineWidth(0.5)
            self.line(0, h - 14*mm, w, h - 14*mm)
            # Logo in header
            self.setFillColor(BLUE)
            self.setFont("Helvetica-Bold", 9)
            self.drawString(15*mm, h - 9.5*mm, "VS Media")
            self.setFillColor(RED)
            self.drawString(15*mm + self.stringWidth("VS Media", "Helvetica-Bold", 9), h - 9.5*mm, " Calendar")
            # Page number
            self.setFillColor(colors.HexColor("#cbd5e1"))
            self.setFont("Helvetica", 7.5)
            pg_text = f"{page_num - 1} / {total - 2}"  # skip cover + end
            self.drawRightString(w - 15*mm, h - 9.5*mm, pg_text)
            # Footer
            self.setFillColor(BORDER)
            self.rect(0, 0, w, 8*mm, fill=1, stroke=0)
            self.setFillColor(colors.HexColor("#94a3b8"))
            self.setFont("Helvetica", 7)
            self.drawCentredString(w / 2, 3*mm, "calendar.vsmedia.pt  ·  Uso interno — Maio 2026")
            # Red bottom bar
            self.setFillColor(RED)
            self.rect(0, 0, w, 1.5, fill=1, stroke=0)


def build_pdf(path):
    S = make_styles()
    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=18*mm, bottomMargin=14*mm,
    )

    story = []

    # ══════════════════════════════════════════════════════════════
    # PÁGINA 1 — CAPA
    # ══════════════════════════════════════════════════════════════
    story.append(Spacer(1, 38*mm))
    story.append(Paragraph("FORMAÇÃO INTERNA · MAIO 2026", S["cover_tag"]))
    story.append(Paragraph("Guia do Consultor", S["title"]))
    story.append(Paragraph(
        "Tudo o que precisas saber para usar a plataforma VS Media Calendar — "
        "desde criar a tua primeira marcação até gerir faturas e receber os teus conteúdos.",
        S["cover_sub"]
    ))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph("calendar.vsmedia.pt", S["url"]))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    # PÁGINA 2 — ACESSO
    # ══════════════════════════════════════════════════════════════
    story.append(Paragraph("PRIMEIROS PASSOS", S["eyebrow"]))
    story.append(Paragraph("Como entrar na plataforma", S["h1"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=4*mm))

    story.append(Paragraph(
        "A VS Media Calendar é acessível em qualquer browser, no telemóvel ou no computador. "
        "O acesso é feito exclusivamente com a tua conta Google (Gmail).",
        S["body"]
    ))

    steps_data = [
        ["1", "Abre o browser", "Vai a calendar.vsmedia.pt no Chrome, Safari ou outro browser."],
        ["2", "Entra com Google", 'Clica em "Entrar com Google" e selecciona a tua conta Gmail.'],
        ["3", "Perfil automático", "O teu nome e foto são importados automaticamente do Google."],
        ["4", "Acesso imediato", "Só contas aprovadas pela VS Media têm acesso. Se não conseguires entrar, contacta a equipa."],
    ]

    step_table_data = []
    for num, label, text in steps_data:
        step_table_data.append([
            Table([[Paragraph(num, S["step_num"])]], colWidths=[8*mm], rowHeights=[8*mm],
                  style=TableStyle([
                      ("BACKGROUND", (0,0), (-1,-1), BLUE),
                      ("ROUNDEDCORNERS", (0,0), (-1,-1), [4,4,4,4]),
                      ("ALIGN", (0,0), (-1,-1), "CENTER"),
                      ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
                  ])),
            Paragraph(f"<b>{label}</b><br/><font size='8' color='#64748b'>{text}</font>", S["body_small"]),
        ])

    story.append(Table(
        step_table_data,
        colWidths=[14*mm, None],
        style=TableStyle([
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("TOPPADDING", (0,0), (-1,-1), 3),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("LEFTPADDING", (1,0), (1,-1), 5),
        ])
    ))

    story.append(Spacer(1, 4*mm))

    note_data = [[
        Paragraph(
            "💡  <b>Compatível com telemóvel.</b> Podes gerir todas as tuas marcações directamente "
            "do iPhone ou Android, sem instalar nenhuma app.",
            S["note"]
        )
    ]]
    story.append(Table(note_data, colWidths=[W - 30*mm],
        style=TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#eff6ff")),
            ("ROUNDEDCORNERS", (0,0), (-1,-1), [4,4,4,4]),
            ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#bfdbfe")),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
            ("RIGHTPADDING", (0,0), (-1,-1), 6),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ])
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    # PÁGINA 3 — CRIAR MARCAÇÃO
    # ══════════════════════════════════════════════════════════════
    story.append(Paragraph("MARCAR UM SERVIÇO", S["eyebrow"]))
    story.append(Paragraph("Como criar uma marcação", S["h1"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=4*mm))

    story.append(Paragraph(
        "O processo de marcação é um assistente em 5 passos. Podes criar uma marcação em menos de 2 minutos.",
        S["body"]
    ))

    passos = [
        ("1", "Videógrafo", "Escolhe o videógrafo disponível. Só aparecem os que estão a aceitar trabalho."),
        ("2", "Serviços", "Selecciona os serviços que precisas: vídeo, drone, IA, fotografia."),
        ("3", "Data e Hora", "Escolhe o dia (mínimo amanhã) e o horário disponível — slots de 30 min, das 08h às 17h."),
        ("4", "Imóvel", "Introduz a morada completa e a tipologia do imóvel (T1, T2, T3…)."),
        ("5", "Confirmação", "Revê o resumo, escolhe o tipo de pagamento e submete."),
    ]

    passo_rows = [[
        Paragraph(f"<b>Passo {p[0]}</b>", S["step_label"]),
        Paragraph(f"<b>{p[1]}</b>", S["step_label"]),
        Paragraph(p[2], S["step_text"]),
    ] for p in passos]

    story.append(Table(
        passo_rows,
        colWidths=[20*mm, 30*mm, None],
        style=TableStyle([
            ("BACKGROUND", (0,0), (0,-1), colors.HexColor("#f8fafc")),
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#f0f9ff")),
            ("TEXTCOLOR", (0,0), (0,-1), BLUE),
            ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (0,-1), 9),
            ("ALIGN", (0,0), (0,-1), "CENTER"),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.HexColor("#f8fafc"), colors.white]),
            ("LINEBELOW", (0,0), (-1,-2), 0.4, BORDER),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("LEFTPADDING", (0,0), (-1,-1), 5),
        ])
    ))

    story.append(Spacer(1, 4*mm))

    # Deslocação note
    desl_data = [[
        Paragraph(
            "🚗  <b>Taxa de deslocação.</b> Calculada automaticamente com base na distância ao imóvel. "
            "Se a deslocação for superior a 1 hora, é adicionada uma taxa ao valor do serviço.",
            S["note"]
        )
    ]]
    story.append(Table(desl_data, colWidths=[W - 30*mm],
        style=TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#fffbeb")),
            ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#fde68a")),
            ("ROUNDEDCORNERS", (0,0), (-1,-1), [4,4,4,4]),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
            ("RIGHTPADDING", (0,0), (-1,-1), 6),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ])
    ))

    story.append(Spacer(1, 3*mm))
    confirm_data = [[
        Paragraph(
            "✉️  <b>Email automático.</b> Após submeteres, o videógrafo recebe um email com todos os detalhes "
            "e tem de aceitar a marcação. Recebes um email de confirmação assim que aceitar.",
            S["note"]
        )
    ]]
    story.append(Table(confirm_data, colWidths=[W - 30*mm],
        style=TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#f0fdf4")),
            ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#bbf7d0")),
            ("ROUNDEDCORNERS", (0,0), (-1,-1), [4,4,4,4]),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
            ("RIGHTPADDING", (0,0), (-1,-1), 6),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ])
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    # PÁGINA 4 — SERVIÇOS E PREÇOS
    # ══════════════════════════════════════════════════════════════
    story.append(Paragraph("CATÁLOGO", S["eyebrow"]))
    story.append(Paragraph("Serviços e preços", S["h1"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=4*mm))

    header = [
        Paragraph("Serviço", S["th"]),
        Paragraph("Descrição", S["th"]),
        Paragraph("Preço (s/ IVA)", S["th"]),
    ]

    servicos = [
        ("🎬  Vídeo Standard", "Vídeo profissional do imóvel com edição completa incluída", "100 €"),
        ("🚁  Vídeo Drone", "Filmagem aérea exterior com drone profissional", "120 €"),
        ("✦  Taxa IA no Vídeo", "Melhorias e efeitos com inteligência artificial aplicados ao vídeo", "25 €"),
        ("📷  Foto Drone", "Fotografia aérea exterior com drone", "35 €"),
        ("📷  Foto T1 / T2", "Fotografia profissional de interior — tipologia T1 ou T2", "25 €"),
        ("📷  Foto T3 / T4", "Fotografia profissional de interior — tipologia T3 ou T4", "35 €"),
        ("📷  Foto T5+", "Fotografia profissional de interior — tipologia T5 ou superior", "45 €"),
        ("🎙️  Intro adicional", "Versão personalizada do vídeo com a tua introdução (por consultor)", "25 €"),
        ("🚗  Taxa deslocação", "Aplicada automaticamente quando a distância supera 1 hora", "50 €"),
    ]

    table_data = [header]
    for s in servicos:
        table_data.append([
            Paragraph(s[0], S["td_accent"]),
            Paragraph(s[1], S["td"]),
            Paragraph(f"<b>{s[2]}</b>", S["td_accent"]),
        ])

    story.append(Table(
        table_data,
        colWidths=[45*mm, None, 30*mm],
        style=TableStyle([
            ("BACKGROUND", (0,0), (-1,0), NAVY),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.HexColor("#f8fafc"), colors.white]),
            ("LINEBELOW", (0,0), (-1,0), 1, NAVY),
            ("LINEBELOW", (0,1), (-1,-1), 0.4, BORDER),
            ("ALIGN", (2,0), (2,-1), "RIGHT"),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
            ("RIGHTPADDING", (0,0), (-1,-1), 6),
            ("BOX", (0,0), (-1,-1), 0.5, BORDER),
        ])
    ))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        "Os preços apresentados são sem IVA. A fatura incluirá IVA à taxa legal em vigor (23%).",
        S["caption"]
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    # PÁGINA 5 — PAGAMENTOS
    # ══════════════════════════════════════════════════════════════
    story.append(Paragraph("FATURAÇÃO", S["eyebrow"]))
    story.append(Paragraph("Dois modelos de pagamento", S["h1"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=4*mm))

    # Two columns side by side
    col1 = [
        [Paragraph("TAXA FIXA", ParagraphStyle("th2", fontName="Helvetica-Bold", fontSize=8,
                   textColor=colors.white, charSpace=1))],
        [Paragraph("Pago no final do mês", ParagraphStyle("h2w", fontName="Helvetica-Bold",
                   fontSize=12, textColor=colors.white, spaceAfter=2*mm, leading=15))],
        [Paragraph(
            "Os serviços são acumulados ao longo do mês e faturados no último dia. "
            "Recebes o PDF da fatura por email e pagas online por cartão.",
            ParagraphStyle("bw", fontName="Helvetica", fontSize=8.5, textColor=colors.HexColor("#94a3b8"), leading=13)
        )],
        [Spacer(1, 3*mm)],
        [Paragraph("✓  Fatura gerada automaticamente", ParagraphStyle("cw", fontName="Helvetica", fontSize=8.5, textColor=colors.HexColor("#cbd5e1"), leading=13))],
        [Paragraph("✓  Pagamento por cartão (Stripe)", ParagraphStyle("cw", fontName="Helvetica", fontSize=8.5, textColor=colors.HexColor("#cbd5e1"), leading=13))],
        [Paragraph("✓  Histórico dos últimos 6 meses", ParagraphStyle("cw", fontName="Helvetica", fontSize=8.5, textColor=colors.HexColor("#cbd5e1"), leading=13))],
    ]

    col2_items = [
        ("✦  Comissão de Venda", colors.HexColor("#f5f3ff"), colors.HexColor("#ddd6fe"),
         "Não pagas nada agora. Quando o imóvel for vendido, introduzes o valor de venda na "
         "plataforma e pagas <b>0,15%</b> desse valor."),
        ("🔒  Faturas em atraso", colors.HexColor("#fffbeb"), colors.HexColor("#fde68a"),
         "Se tiveres faturas por pagar, as marcações em taxa fixa ficam bloqueadas. "
         "Podes continuar a marcar em <b>modo comissão</b> enquanto regularizas."),
        ("💳  Pagamento seguro", colors.HexColor("#f0fdf4"), colors.HexColor("#bbf7d0"),
         "Os pagamentos são processados pelo <b>Stripe</b>. Aceita Visa, Mastercard e outros cartões."),
    ]

    def make_info_card(title, bg, border, text):
        return Table([[
            Paragraph(f"<b>{title}</b><br/><font size='8' color='#64748b'>{text}</font>", S["body_small"])
        ]], colWidths=[(W - 30*mm) / 2 - 4*mm],
        style=TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), bg),
            ("BOX", (0,0), (-1,-1), 0.5, border),
            ("ROUNDEDCORNERS", (0,0), (-1,-1), [4,4,4,4]),
            ("LEFTPADDING", (0,0), (-1,-1), 5),
            ("RIGHTPADDING", (0,0), (-1,-1), 5),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ]))

    col_w = (W - 30*mm) / 2 - 3*mm

    left_table = Table(col1, colWidths=[col_w],
        style=TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), NAVY),
            ("ROUNDEDCORNERS", (0,0), (-1,-1), [5,5,5,5]),
            ("LEFTPADDING", (0,0), (-1,-1), 7),
            ("RIGHTPADDING", (0,0), (-1,-1), 7),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 2),
        ]))

    right_content = [[make_info_card(t, bg, bd, tx)] for t, bg, bd, tx in col2_items]
    right_table = Table(right_content, colWidths=[col_w],
        style=TableStyle([
            ("TOPPADDING", (0,0), (-1,-1), 2),
            ("BOTTOMPADDING", (0,0), (-1,-1), 2),
        ]))

    two_col = Table([[left_table, right_table]],
        colWidths=[col_w + 3*mm, col_w + 3*mm],
        style=TableStyle([
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("LEFTPADDING", (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ]))

    story.append(two_col)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    # PÁGINA 6 — ESTADOS + RECEBER CONTEÚDO
    # ══════════════════════════════════════════════════════════════
    story.append(Paragraph("ACOMPANHAMENTO", S["eyebrow"]))
    story.append(Paragraph("Estados e entrega do conteúdo", S["h1"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=4*mm))

    # Status table
    estados = [
        [Paragraph("Estado", S["th"]), Paragraph("Significado", S["th"]), Paragraph("O que fazer", S["th"])],
        [Paragraph("🟡  Pendente", S["td_accent"]),
         Paragraph("O videógrafo ainda não respondeu", S["td"]),
         Paragraph("Aguardar — recebes email quando aceitar", S["td"])],
        [Paragraph("🔵  Aceite", S["td_accent"]),
         Paragraph("Videógrafo confirmou a marcação", S["td"]),
         Paragraph("Nada — aguardar o dia do serviço", S["td"])],
        [Paragraph("⚙️  Em Progresso", S["td_accent"]),
         Paragraph("Serviço em curso", S["td"]),
         Paragraph("Nada — o videógrafo está no imóvel", S["td"])],
        [Paragraph("📁  Ficheiro Entregue", S["td_accent"]),
         Paragraph("Vídeo/fotos disponíveis para download", S["td"]),
         Paragraph("Descarregar o conteúdo (disponível 15 dias)", S["td"])],
        [Paragraph("✅  Concluído", S["td_accent"]),
         Paragraph("Processo totalmente terminado", S["td"]),
         Paragraph("—", S["td"])],
        [Paragraph("❌  Recusado", S["td_accent"]),
         Paragraph("Videógrafo não pôde aceitar", S["td"]),
         Paragraph("Criar nova marcação com outro videógrafo", S["td"])],
    ]

    story.append(Table(
        estados,
        colWidths=[40*mm, 70*mm, None],
        style=TableStyle([
            ("BACKGROUND", (0,0), (-1,0), NAVY),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.HexColor("#f8fafc"), colors.white]),
            ("LINEBELOW", (0,0), (-1,-1), 0.4, BORDER),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
            ("BOX", (0,0), (-1,-1), 0.5, BORDER),
        ])
    ))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("Receber o conteúdo", S["h2"]))

    conteudo_items = [
        "Quando o videógrafo entrega o ficheiro, recebes um <b>email de notificação</b> imediato.",
        "O vídeo pode ser visualizado directamente no browser, sem precisares de descarregar.",
        "Clica em <b>Download</b> para guardar o ficheiro no teu dispositivo.",
        "Os ficheiros estão disponíveis durante <b>15 dias</b> após o upload — descarrega antes que expirem.",
    ]
    for item in conteudo_items:
        story.append(Paragraph(f"<bullet>&bull;</bullet>  {item}", S["bullet"]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    # PÁGINA FINAL — CALL TO ACTION
    # ══════════════════════════════════════════════════════════════
    story.append(Spacer(1, 45*mm))
    story.append(Paragraph("Pronto para começar?", S["end_sub"]))
    story.append(Paragraph("Entra já na plataforma", S["end_title"]))
    story.append(Paragraph(
        "Faz login com a tua conta Google e cria a tua primeira marcação",
        S["end_sub"]
    ))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("calendar.vsmedia.pt", S["url"]))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph("Dúvidas? Contacta a equipa VS Media.", S["end_sub"]))

    doc.build(story, canvasmaker=NumberedCanvas)
    print("PDF gerado:", path)


build_pdf("/home/user/VS-Media-Calendar-/Apresentacao_Consultores_VS_Media.pdf")
