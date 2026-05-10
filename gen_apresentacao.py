"""
VS Media Calendar — Apresentação para Consultores
A4 landscape · azul navy + branco · sem vermelho
"""
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame,
    Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether, Image
)
from reportlab.platypus.flowables import Flowable
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF

W, H = landscape(A4)   # 841.9 x 595.3 pt

NAVY  = colors.HexColor("#0f172a")
BLUE  = colors.HexColor("#0f3460")
BLUE2 = colors.HexColor("#1e3a5f")
SLATE = colors.HexColor("#64748b")
LIGHT = colors.HexColor("#f1f5f9")
BORDER= colors.HexColor("#e2e8f0")
WHITE = colors.white

LOGO_PATH = "/home/user/VS-Media-Calendar-/vs-media-calendar/public/logo.svg"

# ── Helpers ───────────────────────────────────────────────────────────────────

def s(name, **kw):
    defaults = dict(fontName="Helvetica", fontSize=9, leading=13,
                    textColor=colors.HexColor("#1e293b"), spaceAfter=2*mm)
    defaults.update(kw)
    return ParagraphStyle(name, **defaults)

STYLES = {
    # cover
    "cover_tag":  s("cover_tag",  fontName="Helvetica-Bold", fontSize=7.5,
                    textColor=colors.HexColor("#94a3b8"), charSpace=2, spaceAfter=3*mm),
    "cover_title":s("cover_title",fontName="Helvetica-Bold", fontSize=36, leading=40,
                    textColor=WHITE, spaceAfter=4*mm),
    "cover_sub":  s("cover_sub",  fontSize=11, leading=17,
                    textColor=colors.HexColor("#94a3b8"), spaceAfter=6*mm),
    "cover_url":  s("cover_url",  fontName="Helvetica-Bold", fontSize=11,
                    textColor=colors.HexColor("#60a5fa"), spaceAfter=0),
    # body
    "eyebrow":    s("eyebrow",    fontName="Helvetica-Bold", fontSize=7, charSpace=1.5,
                    textColor=BLUE, spaceAfter=1*mm, spaceBefore=0),
    "h1":         s("h1",         fontName="Helvetica-Bold", fontSize=19, leading=23,
                    textColor=NAVY, spaceAfter=2*mm),
    "h2":         s("h2",         fontName="Helvetica-Bold", fontSize=11, leading=14,
                    textColor=BLUE, spaceBefore=3*mm, spaceAfter=1.5*mm),
    "body":       s("body",       fontSize=9.5, leading=14,
                    textColor=colors.HexColor("#334155"), spaceAfter=2*mm),
    "body_sm":    s("body_sm",    fontSize=8.5, leading=13,
                    textColor=SLATE, spaceAfter=1.5*mm),
    "bullet":     s("bullet",     fontSize=9, leading=13,
                    textColor=colors.HexColor("#334155"),
                    leftIndent=8, firstLineIndent=-8, spaceAfter=1.5*mm),
    "th":         s("th",         fontName="Helvetica-Bold", fontSize=8.5, leading=11,
                    textColor=WHITE),
    "td":         s("td",         fontSize=8.5, leading=12,
                    textColor=colors.HexColor("#1e293b")),
    "td_b":       s("td_b",       fontName="Helvetica-Bold", fontSize=8.5, leading=12,
                    textColor=BLUE),
    "note":       s("note",       fontSize=8.5, leading=13,
                    textColor=colors.HexColor("#1e3a5f")),
    "caption":    s("caption",    fontSize=7.5, leading=10,
                    textColor=SLATE, alignment=TA_CENTER, spaceAfter=2*mm),
    "end_tag":    s("end_tag",    fontName="Helvetica-Bold", fontSize=7.5, charSpace=1.5,
                    textColor=colors.HexColor("#475569"), alignment=TA_CENTER, spaceAfter=3*mm),
    "end_title":  s("end_title",  fontName="Helvetica-Bold", fontSize=26, leading=30,
                    textColor=WHITE, alignment=TA_CENTER, spaceAfter=3*mm),
    "end_sub":    s("end_sub",    fontSize=10, leading=14,
                    textColor=colors.HexColor("#94a3b8"), alignment=TA_CENTER, spaceAfter=4*mm),
    "end_url":    s("end_url",    fontName="Helvetica-Bold", fontSize=14,
                    textColor=colors.HexColor("#60a5fa"), alignment=TA_CENTER),
}

def info_box(text, bg="#eff6ff", border="#bfdbfe"):
    return Table([[Paragraph(text, STYLES["note"])]], colWidths=[W - 40*mm],
        style=TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), colors.HexColor(bg)),
            ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor(border)),
            ("ROUNDEDCORNERS", (0,0), (-1,-1), [4,4,4,4]),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
            ("RIGHTPADDING", (0,0), (-1,-1), 6),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ]))

def card(title, body_text, bg="#f8fafc", border="#e2e8f0", col_w=None):
    w = col_w or ((W - 40*mm) / 2 - 3*mm)
    return Table([[
        Paragraph(
            f"<b>{title}</b><br/>"
            f"<font size='8' color='#64748b'>{body_text}</font>",
            STYLES["body_sm"]
        )
    ]], colWidths=[w],
    style=TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor(bg)),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor(border)),
        ("ROUNDEDCORNERS", (0,0), (-1,-1), [4,4,4,4]),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ]))

# ── Page chrome ───────────────────────────────────────────────────────────────

HEADER_H = 14*mm
FOOTER_H =  9*mm

def get_logo_drawing(width=28*mm):
    try:
        drawing = svg2rlg(LOGO_PATH)
        if drawing:
            sx = width / drawing.width
            drawing.width  = width
            drawing.height = drawing.height * sx
            drawing.transform = (sx, 0, 0, sx, 0, 0)
            return drawing
    except Exception:
        pass
    return None

def draw_cover(canvas, doc):
    canvas.saveState()
    # Full dark background
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # Blue gradient left strip
    canvas.setFillColor(BLUE)
    canvas.rect(0, 0, 8*mm, H, fill=1, stroke=0)
    # Dot pattern right side
    canvas.setFillColor(WHITE)
    canvas.setFillAlpha(0.05)
    for r in range(10):
        for c in range(14):
            cx = W/2 + 10*mm + c*10*mm
            cy = 10*mm + r*10*mm
            if cx < W and cy < H:
                canvas.circle(cx, cy, 1.5, fill=1, stroke=0)
    canvas.setFillAlpha(1)
    # Logo (white) top-left
    logo = get_logo_drawing(32*mm)
    if logo:
        logo_y = H - HEADER_H/2 - logo.height/2
        renderPDF.draw(logo, canvas, 15*mm, logo_y)
    else:
        canvas.setFillColor(WHITE)
        canvas.setFont("Helvetica-Bold", 11)
        canvas.drawString(15*mm, H - 10*mm, "VS.MEDIA")
    canvas.restoreState()

def draw_content(canvas, doc):
    canvas.saveState()
    # White page
    canvas.setFillColor(WHITE)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # Navy header bar
    canvas.setFillColor(NAVY)
    canvas.rect(0, H - HEADER_H, W, HEADER_H, fill=1, stroke=0)
    # Logo in header
    logo = get_logo_drawing(22*mm)
    if logo:
        logo_y = H - HEADER_H/2 - logo.height/2
        renderPDF.draw(logo, canvas, 15*mm, logo_y)
    else:
        canvas.setFillColor(WHITE)
        canvas.setFont("Helvetica-Bold", 9)
        canvas.drawString(15*mm, H - 9*mm, "VS.MEDIA")
    # Page number (right in header)
    canvas.setFillColor(colors.HexColor("#94a3b8"))
    canvas.setFont("Helvetica", 8)
    pg = getattr(doc, "_page_count_display", "")
    canvas.drawRightString(W - 15*mm, H - 8.5*mm, pg)
    # Footer
    canvas.setFillColor(LIGHT)
    canvas.rect(0, 0, W, FOOTER_H, fill=1, stroke=0)
    canvas.setFillColor(SLATE)
    canvas.setFont("Helvetica", 7)
    canvas.drawCentredString(W/2, 3*mm, "calendar.vsmedia.pt  ·  Uso interno — Maio 2026")
    # Thin blue top accent
    canvas.setFillColor(BLUE)
    canvas.rect(0, H - HEADER_H - 1, W, 1, fill=1, stroke=0)
    canvas.restoreState()

def draw_end(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    canvas.setFillColor(BLUE)
    canvas.rect(0, 0, W, 3, fill=1, stroke=0)
    canvas.setFillAlpha(0.05)
    canvas.setFillColor(WHITE)
    for r in range(8):
        for c in range(20):
            cx = c * 14*mm
            cy = 10*mm + r * 11*mm
            if cx < W and cy < H:
                canvas.circle(cx, cy, 1.2, fill=1, stroke=0)
    canvas.setFillAlpha(1)
    canvas.restoreState()

# ── Content builders ──────────────────────────────────────────────────────────

def page_cover():
    items = []
    items.append(Spacer(1, 28*mm))
    items.append(Paragraph("GUIA PARA CONSULTORES · MAIO 2026", STYLES["cover_tag"]))
    items.append(Paragraph("Como usar a<br/>VS Media Calendar", STYLES["cover_title"]))
    items.append(Paragraph(
        "Tudo o que precisas saber — desde criar a tua primeira marcação "
        "até receber os conteúdos e gerir os teus pagamentos.",
        STYLES["cover_sub"]
    ))
    items.append(Paragraph("calendar.vsmedia.pt", STYLES["cover_url"]))
    items.append(PageBreak())
    return items

def page_acesso():
    items = []
    items.append(Paragraph("PRIMEIROS PASSOS", STYLES["eyebrow"]))
    items.append(Paragraph("Como entrar na plataforma", STYLES["h1"]))
    items.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=4*mm))

    items.append(Paragraph(
        "A plataforma funciona em qualquer browser — no computador ou no telemóvel. "
        "O acesso é feito com a tua conta Google (Gmail).",
        STYLES["body"]
    ))

    passos = [
        ("1", "Abre o browser",     "Vai a calendar.vsmedia.pt — Chrome, Safari ou Edge."),
        ("2", "Entra com Google",   'Clica "Entrar com Google" e selecciona a tua conta Gmail.'),
        ("3", "Perfil automático",  "O teu nome e foto são importados automaticamente."),
        ("4", "Acesso imediato",    "Só contas aprovadas pela VS Media têm acesso."),
    ]

    def num_cell(n):
        return Table([[Paragraph(f"<b>{n}</b>",
            ParagraphStyle("n", fontName="Helvetica-Bold", fontSize=10,
                           textColor=WHITE, alignment=TA_CENTER))]],
            colWidths=[7*mm], rowHeights=[7*mm],
            style=TableStyle([
                ("BACKGROUND", (0,0), (-1,-1), BLUE),
                ("ROUNDEDCORNERS", (0,0), (-1,-1), [14,14,14,14]),
                ("ALIGN", (0,0), (-1,-1), "CENTER"),
                ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
                ("TOPPADDING", (0,0), (-1,-1), 0),
                ("BOTTOMPADDING", (0,0), (-1,-1), 0),
            ]))

    rows = [[num_cell(p[0]),
             Paragraph(f"<b>{p[1]}</b><br/><font size='8' color='#64748b'>{p[2]}</font>",
                       STYLES["body_sm"])]
            for p in passos]

    items.append(Table(rows, colWidths=[12*mm, None],
        style=TableStyle([
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING", (1,0), (1,-1), 5),
        ])))

    items.append(Spacer(1, 3*mm))
    items.append(info_box(
        "📱  <b>Mobile.</b> Podes gerir tudo directamente do telemóvel, sem instalar nenhuma app.",
        bg="#eff6ff", border="#bfdbfe"
    ))
    items.append(PageBreak())
    return items

def page_marcacao():
    items = []
    items.append(Paragraph("MARCAR UM SERVIÇO", STYLES["eyebrow"]))
    items.append(Paragraph("Como criar uma marcação", STYLES["h1"]))
    items.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=4*mm))
    items.append(Paragraph(
        "Processo em 5 passos. Podes criar uma marcação em menos de 2 minutos.",
        STYLES["body"]
    ))

    passos = [
        ("1", "Videógrafo",   "Escolhe o videógrafo. Só aparecem\nos que estão disponíveis."),
        ("2", "Serviços",     "Selecciona os serviços:\nvídeo, drone, IA, fotografia."),
        ("3", "Data e Hora",  "Escolhe o dia e horário\ndisponível (slots de 30 min)."),
        ("4", "Imóvel",       "Morada completa\ne tipologia (T1, T2…)."),
        ("5", "Confirmação",  "Revê o resumo, escolhe\no pagamento e submete."),
    ]

    col_w = (W - 40*mm) / 5

    def step_col(num, label, text):
        return Table([
            [Table([[Paragraph(num, ParagraphStyle("sn", fontName="Helvetica-Bold",
                fontSize=11, textColor=WHITE, alignment=TA_CENTER))]],
                colWidths=[9*mm], rowHeights=[9*mm],
                style=TableStyle([
                    ("BACKGROUND", (0,0), (-1,-1), BLUE),
                    ("ROUNDEDCORNERS", (0,0), (-1,-1), [18,18,18,18]),
                    ("ALIGN", (0,0), (-1,-1), "CENTER"),
                    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
                    ("TOPPADDING", (0,0), (-1,-1), 0),
                    ("BOTTOMPADDING", (0,0), (-1,-1), 0),
                ]))],
            [Paragraph(f"<b>{label}</b>", ParagraphStyle("sl", fontName="Helvetica-Bold",
                fontSize=8.5, textColor=NAVY, leading=11, spaceAfter=1*mm))],
            [Paragraph(text, ParagraphStyle("st", fontSize=7.5, textColor=SLATE,
                leading=11))],
        ], colWidths=[col_w - 4*mm],
        style=TableStyle([
            ("ALIGN", (0,0), (-1,-1), "CENTER"),
            ("TOPPADDING", (0,0), (-1,-1), 2),
            ("BOTTOMPADDING", (0,0), (-1,-1), 2),
            ("BACKGROUND", (0,0), (-1,-1), LIGHT),
            ("ROUNDEDCORNERS", (0,0), (-1,-1), [4,4,4,4]),
            ("BOX", (0,0), (-1,-1), 0.5, BORDER),
            ("LEFTPADDING", (0,0), (-1,-1), 3),
            ("RIGHTPADDING", (0,0), (-1,-1), 3),
        ]))

    row = [[step_col(p[0], p[1], p[2]) for p in passos]]
    items.append(Table(row,
        colWidths=[col_w] * 5,
        style=TableStyle([
            ("ALIGN", (0,0), (-1,-1), "CENTER"),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("LEFTPADDING", (0,0), (-1,-1), 2),
            ("RIGHTPADDING", (0,0), (-1,-1), 2),
        ])))

    items.append(Spacer(1, 4*mm))
    items.append(info_box(
        "🚗  <b>Deslocação.</b> Calculada automaticamente. Se superior a 1 hora, é adicionada uma taxa de 50 € ao serviço.",
        bg="#f0f9ff", border="#bae6fd"
    ))
    items.append(Spacer(1, 2*mm))
    items.append(info_box(
        "✉️  <b>Confirmação por email.</b> Após submeteres, o videógrafo recebe um email e tem de aceitar. "
        "Recebes confirmação assim que aceitar.",
        bg="#f0fdf4", border="#bbf7d0"
    ))
    items.append(PageBreak())
    return items

def page_servicos():
    items = []
    items.append(Paragraph("CATÁLOGO", STYLES["eyebrow"]))
    items.append(Paragraph("Serviços e preços", STYLES["h1"]))
    items.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=4*mm))

    header = [
        Paragraph("Serviço", STYLES["th"]),
        Paragraph("Descrição", STYLES["th"]),
        Paragraph("Preço s/ IVA", STYLES["th"]),
    ]
    rows = [
        ("🎬  Vídeo Standard",      "Vídeo profissional com edição completa incluída",                "100 €"),
        ("🚁  Vídeo com Drone",     "Filmagem aérea exterior com drone profissional",                 "120 €"),
        ("✦   Taxa IA no Vídeo",    "Melhorias e efeitos de inteligência artificial aplicados ao vídeo","25 €"),
        ("📷  Fotografia Drone",    "Fotografia aérea exterior",                                       "35 €"),
        ("📷  Fotografia T1/T2",    "Fotografia profissional de interior — tipologia T1 ou T2",        "25 €"),
        ("📷  Fotografia T3/T4",    "Fotografia profissional de interior — tipologia T3 ou T4",        "35 €"),
        ("📷  Fotografia T5+",      "Fotografia profissional de interior — tipologia T5 ou superior",  "45 €"),
        ("🎙️  Intro adicional",     "Versão do vídeo com a tua introdução personalizada (por consultor)","25 €"),
        ("🚗  Taxa de deslocação",  "Aplicada automaticamente quando a distância supera 1 hora",       "50 €"),
    ]

    table_data = [header] + [
        [Paragraph(r[0], STYLES["td_b"]),
         Paragraph(r[1], STYLES["td"]),
         Paragraph(f"<b>{r[2]}</b>", STYLES["td_b"])]
        for r in rows
    ]

    items.append(Table(table_data, colWidths=[42*mm, None, 28*mm],
        style=TableStyle([
            ("BACKGROUND", (0,0), (-1,0), NAVY),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [LIGHT, WHITE]),
            ("LINEBELOW", (0,0), (-1,-1), 0.4, BORDER),
            ("ALIGN", (2,0), (2,-1), "RIGHT"),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
            ("RIGHTPADDING", (0,0), (-1,-1), 6),
            ("BOX", (0,0), (-1,-1), 0.5, BORDER),
        ])))

    items.append(Spacer(1, 2*mm))
    items.append(Paragraph(
        "Os preços apresentados são sem IVA. A fatura incluirá IVA à taxa legal em vigor (23%).",
        STYLES["caption"]
    ))
    items.append(PageBreak())
    return items

def page_pagamentos():
    items = []
    items.append(Paragraph("FATURAÇÃO", STYLES["eyebrow"]))
    items.append(Paragraph("Dois modelos de pagamento", STYLES["h1"]))
    items.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=4*mm))

    col_w = (W - 40*mm) / 2 - 3*mm

    # Left — dark card
    left_rows = [
        [Paragraph("TAXA FIXA", ParagraphStyle("lh", fontName="Helvetica-Bold", fontSize=7,
                   textColor=colors.HexColor("#60a5fa"), charSpace=1.5))],
        [Paragraph("Pago no final do mês", ParagraphStyle("lt", fontName="Helvetica-Bold",
                   fontSize=12, textColor=WHITE, leading=15, spaceAfter=2*mm))],
        [Paragraph("Os serviços acumulam ao longo do mês. No último dia é gerada uma fatura "
                   "automática. Pagas online com cartão.", ParagraphStyle("lb", fontSize=8.5,
                   textColor=colors.HexColor("#94a3b8"), leading=13))],
        [Spacer(1, 2*mm)],
        [Paragraph("✓  Fatura gerada automaticamente no último dia do mês",
                   ParagraphStyle("lc", fontSize=8, textColor=colors.HexColor("#cbd5e1"), leading=13))],
        [Paragraph("✓  Pagamento seguro por cartão (Stripe)",
                   ParagraphStyle("lc", fontSize=8, textColor=colors.HexColor("#cbd5e1"), leading=13))],
        [Paragraph("✓  Histórico dos últimos 6 meses disponível na plataforma",
                   ParagraphStyle("lc", fontSize=8, textColor=colors.HexColor("#cbd5e1"), leading=13))],
    ]
    left = Table(left_rows, colWidths=[col_w],
        style=TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), NAVY),
            ("ROUNDEDCORNERS", (0,0), (-1,-1), [5,5,5,5]),
            ("LEFTPADDING", (0,0), (-1,-1), 7),
            ("RIGHTPADDING", (0,0), (-1,-1), 7),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ]))

    # Right — info cards
    right_cards = [
        card("✦  Comissão de Venda",
             "Alternativa sem pagamento imediato. Quando o imóvel for vendido, "
             "introduzes o valor de venda e pagas 0,15% desse valor.",
             bg="#f0f9ff", border="#bae6fd"),
        card("🔒  Faturas em atraso",
             "Se tiveres faturas por pagar, as marcações em taxa fixa ficam bloqueadas. "
             "Podes continuar a marcar em modo comissão enquanto regularizas.",
             bg="#fefce8", border="#fde68a"),
        card("💳  Pagamento seguro",
             "Os pagamentos são processados pelo Stripe. "
             "Aceita Visa, Mastercard e outros cartões.",
             bg="#f0fdf4", border="#bbf7d0"),
    ]
    right_rows = [[c] for c in right_cards]
    right = Table(right_rows, colWidths=[col_w],
        style=TableStyle([
            ("TOPPADDING", (0,0), (-1,-1), 2),
            ("BOTTOMPADDING", (0,0), (-1,-1), 2),
            ("LEFTPADDING", (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ]))

    items.append(Table([[left, right]], colWidths=[col_w + 3*mm, col_w + 3*mm],
        style=TableStyle([
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("LEFTPADDING", (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ])))
    items.append(PageBreak())
    return items

def page_estados():
    items = []
    items.append(Paragraph("ACOMPANHAMENTO", STYLES["eyebrow"]))
    items.append(Paragraph("Estados e entrega do conteúdo", STYLES["h1"]))
    items.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=4*mm))

    header = [Paragraph(t, STYLES["th"]) for t in ["Estado", "Significado", "O que fazer"]]
    estados = [
        ("🟡  Pendente",         "O videógrafo ainda não respondeu",             "Aguardar — recebes email quando aceitar"),
        ("🔵  Aceite",           "Videógrafo confirmou a marcação",              "Nada — aguardar o dia do serviço"),
        ("⚙️   Em Progresso",    "Serviço em curso no imóvel",                   "Nada — o videógrafo está a filmar"),
        ("📁  Ficheiro Entregue","Vídeo/fotos disponíveis para download",        "Descarregar antes dos 15 dias"),
        ("✅  Concluído",        "Processo totalmente terminado",                "—"),
        ("❌  Recusado",         "Videógrafo não pôde aceitar",                  "Criar nova marcação com outro videógrafo"),
    ]
    rows = [header] + [
        [Paragraph(e[0], STYLES["td_b"]),
         Paragraph(e[1], STYLES["td"]),
         Paragraph(e[2], STYLES["td"])]
        for e in estados
    ]
    items.append(Table(rows, colWidths=[38*mm, 75*mm, None],
        style=TableStyle([
            ("BACKGROUND", (0,0), (-1,0), NAVY),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [LIGHT, WHITE]),
            ("LINEBELOW", (0,0), (-1,-1), 0.4, BORDER),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
            ("BOX", (0,0), (-1,-1), 0.5, BORDER),
        ])))

    items.append(Spacer(1, 4*mm))
    items.append(Paragraph("Receber o conteúdo", STYLES["h2"]))
    for txt in [
        "Quando o videógrafo entrega, recebes um <b>email de notificação</b> imediato.",
        "O vídeo pode ser visualizado directamente no browser, sem precisares de descarregar.",
        "Os ficheiros estão disponíveis durante <b>15 dias</b> — descarrega antes que o prazo expire.",
    ]:
        items.append(Paragraph(f"▸  {txt}", STYLES["bullet"]))
    items.append(PageBreak())
    return items

def page_end():
    items = []
    items.append(Spacer(1, 38*mm))
    items.append(Paragraph("PRONTO PARA COMEÇAR?", STYLES["end_tag"]))
    items.append(Paragraph("Entra já na plataforma", STYLES["end_title"]))
    items.append(Paragraph(
        "Faz login com a tua conta Google e cria a tua primeira marcação.",
        STYLES["end_sub"]
    ))
    items.append(Spacer(1, 3*mm))
    items.append(Paragraph("calendar.vsmedia.pt", STYLES["end_url"]))
    items.append(Spacer(1, 5*mm))
    items.append(Paragraph("Dúvidas? Contacta a equipa VS Media.", STYLES["end_sub"]))
    return items

# ── Build ─────────────────────────────────────────────────────────────────────

def build():
    out = "/home/user/VS-Media-Calendar-/Apresentacao_Consultores_VS_Media.pdf"

    M = 15*mm
    content_frame = Frame(
        M, FOOTER_H + 2*mm,
        W - 2*M, H - HEADER_H - FOOTER_H - 4*mm,
        leftPadding=0, bottomPadding=0, rightPadding=0, topPadding=4*mm,
        showBoundary=0
    )
    cover_frame = Frame(
        M + 8*mm, FOOTER_H + 2*mm,
        W - 2*M - 8*mm, H - FOOTER_H - 4*mm,
        leftPadding=0, bottomPadding=0, rightPadding=0, topPadding=0,
        showBoundary=0
    )

    doc = BaseDocTemplate(
        out, pagesize=landscape(A4),
        leftMargin=M, rightMargin=M,
        topMargin=HEADER_H + 4*mm, bottomMargin=FOOTER_H + 2*mm,
    )

    PAGE_LABELS = {1: "", 2: "1 / 5", 3: "2 / 5", 4: "3 / 5",
                   5: "4 / 5", 6: "5 / 5", 7: ""}

    def make_onpage(label):
        def onpage(canvas, doc):
            doc._page_count_display = label
            if doc.page == 1:
                draw_cover(canvas, doc)
            elif doc.page == 7:
                draw_end(canvas, doc)
            else:
                draw_content(canvas, doc)
        return onpage

    templates = []
    page_draws = {1: draw_cover, 7: draw_end}

    for pg in range(1, 8):
        label = PAGE_LABELS.get(pg, "")
        frame = cover_frame if pg in (1, 7) else content_frame

        def make_cb(pg=pg, label=label):
            def cb(canvas, doc):
                doc._page_count_display = label
                if pg == 1:
                    draw_cover(canvas, doc)
                elif pg == 7:
                    draw_end(canvas, doc)
                else:
                    draw_content(canvas, doc)
            return cb

        templates.append(PageTemplate(id=f"p{pg}", frames=[frame], onPage=make_cb()))

    doc.addPageTemplates(templates)

    story = []
    story += page_cover()
    story += page_acesso()
    story += page_marcacao()
    story += page_servicos()
    story += page_pagamentos()
    story += page_estados()
    story += page_end()

    doc.build(story)
    print(f"PDF gerado: {out}")
    import subprocess
    result = subprocess.run(["pdfinfo", out], capture_output=True, text=True)
    print(result.stdout)

build()
