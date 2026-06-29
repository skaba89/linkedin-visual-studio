#!/usr/bin/env python3
"""
HERMÈS — Volume 2 — Guide d'Implémentation Technique
Body PDF (ReportLab) + Cover (HTML/Playwright already rendered separately).
Final merge via pypdf.
"""
import os
import sys
import hashlib
import platform

PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
sys.path.insert(0, os.path.join(PDF_SKILL_DIR, "scripts"))

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.units import mm, cm, inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, CondPageBreak, Image,
    Preformatted, XPreformatted,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ─── Font registration ───
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansMono', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansMono-Bold', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono-Bold.ttf'))

registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                   italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSansMono', normal='DejaVuSansMono', bold='DejaVuSansMono-Bold')

# ─── Cascade Palette (same as Volume 1) ───
PAGE_BG       = colors.HexColor('#f4f6f5')
SECTION_BG    = colors.HexColor('#e8eae9')
CARD_BG       = colors.HexColor('#ebf0ee')
CODE_BG       = colors.HexColor('#1a2620')
CODE_BORDER   = colors.HexColor('#2c3d35')
TABLE_STRIPE  = colors.HexColor('#ebefed')
HEADER_FILL   = colors.HexColor('#486757')
COVER_BLOCK   = colors.HexColor('#4b6658')
BORDER        = colors.HexColor('#aec0b7')
ICON          = colors.HexColor('#487c62')
ACCENT        = colors.HexColor('#1c9659')
ACCENT_2      = colors.HexColor('#51cdcd')
TEXT_PRIMARY  = colors.HexColor('#181b1a')
TEXT_MUTED    = colors.HexColor('#79847f')
TEXT_CODE     = colors.HexColor('#e8f0ec')
TEXT_CODE_MUTED = colors.HexColor('#8aa399')
TEXT_CODE_KEYWORD = colors.HexColor('#7dd3a8')
TEXT_CODE_STRING = colors.HexColor('#c4d97a')
TEXT_CODE_COMMENT = colors.HexColor('#6b7d72')
SEM_SUCCESS   = colors.HexColor('#4b9464')
SEM_WARNING   = colors.HexColor('#ac8c4b')
SEM_ERROR     = colors.HexColor('#894943')
SEM_INFO      = colors.HexColor('#4f7193')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ─── Page Setup ───
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 22 * mm
RIGHT_MARGIN = 22 * mm
TOP_MARGIN = 25 * mm
BOTTOM_MARGIN = 25 * mm
CONTENT_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

OUTPUT_BODY = '/home/z/my-project/scripts/v2_body.pdf'
OUTPUT_FINAL = '/home/z/my-project/download/HERMES_Volume2_Implementation_2026.pdf'
COVER_PDF = '/home/z/my-project/scripts/v2_cover.pdf'

# ─── Styles ───
BODY_FONT = 'FreeSerif'
BODY_FONT_BOLD = 'FreeSerif-Bold'
CODE_FONT = 'DejaVuSansMono'
CODE_FONT_BOLD = 'DejaVuSansMono-Bold'

sH1 = ParagraphStyle('sH1', fontName=BODY_FONT_BOLD, fontSize=18, leading=24,
                     textColor=HEADER_FILL, spaceBefore=18, spaceAfter=10, alignment=TA_LEFT)
sH2 = ParagraphStyle('sH2', fontName=BODY_FONT_BOLD, fontSize=13.5, leading=18,
                     textColor=ACCENT, spaceBefore=14, spaceAfter=6, alignment=TA_LEFT)
sH3 = ParagraphStyle('sH3', fontName=BODY_FONT_BOLD, fontSize=11.5, leading=16,
                     textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=4, alignment=TA_LEFT)
sH4 = ParagraphStyle('sH4', fontName=BODY_FONT_BOLD, fontSize=10.5, leading=15,
                     textColor=HEADER_FILL, spaceBefore=8, spaceAfter=3, alignment=TA_LEFT)
sBody = ParagraphStyle('sBody', fontName=BODY_FONT, fontSize=10.5, leading=16.5,
                       textColor=TEXT_PRIMARY, spaceAfter=7, alignment=TA_JUSTIFY)
sBodyLeft = ParagraphStyle('sBodyLeft', fontName=BODY_FONT, fontSize=10.5, leading=16.5,
                           textColor=TEXT_PRIMARY, spaceAfter=7, alignment=TA_LEFT)
sBullet = ParagraphStyle('sBullet', fontName=BODY_FONT, fontSize=10.5, leading=16,
                         textColor=TEXT_PRIMARY, spaceAfter=3,
                         leftIndent=16, bulletIndent=4, alignment=TA_LEFT)
sCallout = ParagraphStyle('sCallout', fontName=BODY_FONT_BOLD, fontSize=10.5, leading=16,
                          textColor=HEADER_FILL, spaceAfter=6, alignment=TA_LEFT)
sMeta = ParagraphStyle('sMeta', fontName=BODY_FONT, fontSize=9, leading=12,
                       textColor=TEXT_MUTED, alignment=TA_LEFT)
sTableHead = ParagraphStyle('sTableHead', fontName=BODY_FONT_BOLD, fontSize=9.5, leading=13,
                            textColor=colors.white, alignment=TA_CENTER)
sTableBody = ParagraphStyle('sTableBody', fontName=BODY_FONT, fontSize=9, leading=12.5,
                            textColor=TEXT_PRIMARY, alignment=TA_LEFT)
sTableBodyC = ParagraphStyle('sTableBodyC', fontName=BODY_FONT, fontSize=9, leading=12.5,
                             textColor=TEXT_PRIMARY, alignment=TA_CENTER)
sCode = ParagraphStyle('sCode', fontName=CODE_FONT, fontSize=8, leading=11.5,
                       textColor=TEXT_CODE, alignment=TA_LEFT,
                       leftIndent=0, rightIndent=0, spaceBefore=0, spaceAfter=0)
sCodeLabel = ParagraphStyle('sCodeLabel', fontName=BODY_FONT_BOLD, fontSize=9, leading=12,
                            textColor=TEXT_MUTED, alignment=TA_LEFT, spaceAfter=3)
sStatNum = ParagraphStyle('sStatNum', fontName=BODY_FONT_BOLD, fontSize=22, leading=26,
                          textColor=ACCENT, alignment=TA_CENTER)
sStatLabel = ParagraphStyle('sStatLabel', fontName=BODY_FONT, fontSize=8.5, leading=11,
                            textColor=TEXT_MUTED, alignment=TA_CENTER)
sTOCTitle = ParagraphStyle('sTOCTitle', fontName=BODY_FONT_BOLD, fontSize=22, leading=28,
                           textColor=HEADER_FILL, spaceAfter=14, alignment=TA_LEFT)
sTOCLvl0 = ParagraphStyle('sTOCLvl0', fontName=BODY_FONT_BOLD, fontSize=11.5, leading=18,
                          textColor=TEXT_PRIMARY, leftIndent=0, spaceAfter=2)
sTOCLvl1 = ParagraphStyle('sTOCLvl1', fontName=BODY_FONT, fontSize=10, leading=15,
                          textColor=TEXT_MUTED, leftIndent=18, spaceAfter=2)

# ─── Helpers ───
def hr(thickness=0.5, color=None, sb=4, sa=4):
    return HRFlowable(width="100%", thickness=thickness,
                      color=color or BORDER, spaceBefore=sb, spaceAfter=sa)

def heading(text, style, level=0):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def h1(text):
    return [CondPageBreak(PAGE_H * 0.15), heading(text, sH1, level=0),
            HRFlowable(width="100%", thickness=1.5, color=HEADER_FILL,
                       spaceBefore=0, spaceAfter=10)]

def h2(text):
    return [CondPageBreak(PAGE_H * 0.10), heading(text, sH2, level=1)]

def h3(text):
    return [CondPageBreak(PAGE_H * 0.08), Paragraph(f'<b>{text}</b>', sH3)]

def h4(text):
    return [Paragraph(f'<b>{text}</b>', sH4)]

def body(text):
    return Paragraph(text, sBody)

def body_left(text):
    return Paragraph(text, sBodyLeft)

def bullet(text):
    return Paragraph(f'<bullet>•</bullet> {text}', sBullet)

def callout(title, text, color=None):
    color = color or ACCENT
    data = [
        [Paragraph(f'<b>{title}</b>', ParagraphStyle('calloutT', fontName=BODY_FONT_BOLD,
                  fontSize=10.5, leading=14, textColor=color, alignment=TA_LEFT))],
        [Paragraph(text, ParagraphStyle('calloutB', fontName=BODY_FONT,
                  fontSize=10, leading=15, textColor=TEXT_PRIMARY, alignment=TA_LEFT))]
    ]
    t = Table(data, colWidths=[CONTENT_W - 4])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('LINEBEFORE', (0,0), (0,-1), 3, color),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (0,0), 8),
        ('BOTTOMPADDING', (0,0), (0,0), 2),
        ('TOPPADDING', (0,1), (-1,-1), 0),
        ('BOTTOMPADDING', (0,1), (-1,-1), 8),
    ]))
    return KeepTogether([Spacer(1, 4), t, Spacer(1, 10)])

def stat_box(num, label, num_color=None):
    num_color = num_color or ACCENT
    ns = ParagraphStyle('statN', fontName=BODY_FONT_BOLD, fontSize=20, leading=24,
                        textColor=num_color, alignment=TA_CENTER)
    ls = ParagraphStyle('statL', fontName=BODY_FONT, fontSize=8.5, leading=11,
                        textColor=TEXT_MUTED, alignment=TA_CENTER)
    data = [[Paragraph(f'<b>{num}</b>', ns)],
            [Paragraph(label, ls)]]
    t = Table(data, colWidths=[None])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING', (0,0), (-1,0), 8),
        ('BOTTOMPADDING', (0,0), (-1,0), 2),
        ('TOPPADDING', (0,1), (-1,1), 0),
        ('BOTTOMPADDING', (0,1), (-1,1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    return t

def make_table(header, rows, col_ratios=None, header_align=None):
    """Build a styled table with palette colors. All cells wrapped in Paragraph."""
    if col_ratios:
        total = sum(col_ratios)
        col_widths = [CONTENT_W * (r/total) for r in col_ratios]
    else:
        col_widths = [CONTENT_W / len(header)] * len(header)

    # Build header row
    head_paras = [Paragraph(f'<b>{h}</b>', sTableHead) for h in header]

    # Build body rows
    body_rows = []
    for row in rows:
        r = []
        for cell in row:
            if isinstance(cell, tuple):
                txt, align = cell
                style = sTableBodyC if align == 'C' else sTableBody
            else:
                txt = cell
                style = sTableBody
            r.append(Paragraph(txt, style))
        body_rows.append(r)

    data = [head_paras] + body_rows
    t = Table(data, colWidths=col_widths, repeatRows=1)

    style_cmds = [
        ('BACKGROUND', (0,0), (-1,0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0,0), (-1,0), TABLE_HEADER_TEXT),
        ('FONTNAME', (0,0), (-1,0), BODY_FONT_BOLD),
        ('FONTSIZE', (0,0), (-1,0), 9.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (-1,0), 'CENTER'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,0), 1, HEADER_FILL),
        ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ]
    # Striping
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0,i), (-1,i), TABLE_ROW_ODD))
    t.setStyle(TableStyle(style_cmds))
    return t

# ─── Code block helper ───
def _escape_code(text):
    """Escape XML/HTML special chars for ReportLab Paragraph."""
    return (text.replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;'))

def code_block(code_text, label=None, language=None, splitable=False):
    """
    Render a code block with dark background and monospace font.
    Lines are preserved; very long lines wrap softly.

    If `splitable=True`, the block is allowed to break across pages
    (used for very long code samples).
    """
    # Split into lines, escape, wrap in <br/>
    lines = code_text.rstrip('\n').split('\n')
    escaped_lines = [_escape_code(l) if l else '&nbsp;' for l in lines]
    code_html = '<br/>'.join(escaped_lines)

    p = Paragraph(code_html, sCode)

    # Use a table cell with dark background to host the Paragraph
    cell = [[p]]
    code_table = Table(cell, colWidths=[CONTENT_W - 6])
    code_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CODE_BG),
        ('BOX', (0,0), (-1,-1), 0.5, CODE_BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))

    flowables = []
    if label:
        lang_suffix = f' · {language}' if language else ''
        flowables.append(Paragraph(f'{label}{lang_suffix}', sCodeLabel))
    flowables.append(code_table)
    if splitable:
        return flowables  # list, allowed to split
    return KeepTogether(flowables)

def before_after(before_code, after_code, before_label='Avant', after_label='Après'):
    """Two-column before/after code comparison."""
    def build_block(code_text, label, color):
        lines = code_text.rstrip('\n').split('\n')
        escaped_lines = [_escape_code(l) if l else '&nbsp;' for l in lines]
        code_html = '<br/>'.join(escaped_lines)
        p = Paragraph(code_html, sCode)
        cell = [[p]]
        t = Table(cell, colWidths=[(CONTENT_W - 8) / 2])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), CODE_BG),
            ('BOX', (0,0), (-1,-1), 0.5, CODE_BORDER),
            ('LINEBEFORE', (0,0), (0,-1), 3, color),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        lbl_style = ParagraphStyle('blbl', fontName=BODY_FONT_BOLD, fontSize=9, leading=12,
                                    textColor=color, alignment=TA_LEFT)
        lbl = Paragraph(f'<b>{label}</b>', lbl_style)
        return [lbl, t]

    b_before = build_block(before_code, before_label, SEM_ERROR)
    b_after = build_block(after_code, after_label, SEM_SUCCESS)

    side_by_side = Table(
        [[b_before[0], b_after[0]],
         [b_before[1], b_after[1]]],
        colWidths=[(CONTENT_W - 8) / 2, (CONTENT_W - 8) / 2]
    )
    side_by_side.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    return KeepTogether([Spacer(1, 4), side_by_side, Spacer(1, 10)])

def checklist(items):
    """Render a checklist with checkbox-style bullets."""
    flowables = []
    for it in items:
        p = Paragraph(f'<font color="#1c9659"><b>☐</b></font> &nbsp;{it}', sBullet)
        flowables.append(p)
    return KeepTogether([Spacer(1, 4)] + flowables + [Spacer(1, 8)])

def pitfall(text):
    return callout('Piège à éviter', text, color=SEM_WARNING)

def tip(text):
    return callout('Astuce', text, color=ACCENT_2)


# ─── Doc template with TOC + header/footer ───
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            text = flowable.getPlainText()
            style = flowable.style.name
            if style == 'sH1':
                self.notify('TOCEntry', (0, text, self.page))
            elif style == 'sH2':
                self.notify('TOCEntry', (1, text, self.page))

def _draw_page_chrome(canvas, doc):
    canvas.saveState()
    # Top accent strip
    canvas.setFillColor(HEADER_FILL)
    canvas.rect(0, PAGE_H - 4, PAGE_W, 4, stroke=0, fill=1)
    # Footer page number
    canvas.setFont(BODY_FONT, 8.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(LEFT_MARGIN, 14 * mm, 'HERMÈS · Volume 2 — Guide d\'Implémentation Technique')
    canvas.drawRightString(PAGE_W - RIGHT_MARGIN, 14 * mm, f'Page {doc.page}')
    # Footer line
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.4)
    canvas.line(LEFT_MARGIN, 18 * mm, PAGE_W - RIGHT_MARGIN, 18 * mm)
    canvas.restoreState()


# ─── Story content (filled in chunks) ───
story = []

# ============ TOC ============
story.append(Paragraph('Table des matières', sTOCTitle))
story.append(HRFlowable(width="100%", thickness=1.5, color=HEADER_FILL,
                        spaceBefore=0, spaceAfter=14))

toc = TableOfContents()
toc.levelStyles = [sTOCLvl0, sTOCLvl1]
story.append(toc)
story.append(PageBreak())

# ============ CHAPITRE 1 — Synthèse exécutive du Volume 2 ============
story.extend(h1("1. Synthèse exécutive du Volume 2"))

story.append(body(
    "Le Volume 1 a cartographié dix-neuf risques répartis en trois criticités "
    "et proposé une roadmap de mise en œuvre sur douze semaines. Le présent "
    "volume est le pendant opérationnel : il transforme chaque recommandation "
    "stratégique en un ensemble de livrables techniques directement actionnables "
    "— snippets de code, helpers réutilisables, arbres de décision, checklists "
    "de validation et listes de pièges connus. L'objectif est qu'un développeur "
    "prenant en charge un risque P0 ou P1 puisse livrer la correction sans "
    "avoir à reconcevoir la solution, et sans risque de réintroduire un défaut "
    "déjà identifié lors de l'audit."
))

story.append(body(
    "Le périmètre couvre les huit risques les plus prioritaires : les trois P0 "
    "(authentification, multi-tenant, build strict) et les cinq P1 sélectionnés "
    "pour leur impact transverse (cohérence base de données, rate-limit "
    "distribué, gestion d'erreurs API, stratégie de test, en-têtes de sécurité). "
    "Un dernier chapitre regroupe les quick wins P2 exécutables en moins d'une "
    "demi-journée chacun. Les neuf risques P2 restants seront traités dans un "
    "Volume 3 dédié aux optimisations de second ordre."
))

story.append(callout(
    "Convention de lecture",
    "Chaque chapitre suit la même structure : <b>Objectif</b> (ce que la "
    "correction doit accomplir), <b>Avant</b> (code problématique extrait du "
    "codebase actuel), <b>Après</b> (code corrigé prêt à intégrer), "
    "<b>Helper réutilisable</b> (fonction utilitaire à déposer dans "
    "<font name='DejaVuSansMono'>src/lib/</font>), <b>Checklist</b> (validation "
    "avant fusion) et <b>Pièges à éviter</b> (retours d'expérience). Les "
    "snippets sont en TypeScript et compatibles Next.js 16 / React 19 / Prisma 6.",
    color=SEM_INFO
))

story.extend(h2("1.1 Périmètre traité"))

story.append(make_table(
    header=['Risque', 'Priorité', 'Chapitre', 'Helpers produits', 'Effort'],
    rows=[
        ['R-001', ('P0', 'C'), ('2', 'C'), ('requireSession, hashPassword', 'C'), ('3 j', 'C')],
        ['R-002', ('P0', 'C'), ('3', 'C'), ('requireUser, tenantGuard', 'C'), ('5 j', 'C')],
        ['R-003', ('P0', 'C'), ('4', 'C'), ('narrowUnknown, tsc-check', 'C'), ('4 j', 'C')],
        ['R-004/005', ('P1', 'C'), ('5', 'C'), ('migrate.sh, prismaLog', 'C'), ('1 j', 'C')],
        ['R-007', ('P1', 'C'), ('6', 'C'), ('rateLimit, rateLimiters', 'C'), ('2 j', 'C')],
        ['R-008', ('P1', 'C'), ('7', 'C'), ('withErrorHandler, ApiError', 'C'), ('2 j', 'C')],
        ['R-009', ('P1', 'C'), ('8', 'C'), ('vitest.config, e2e harness', 'C'), ('5 j', 'C')],
        ['R-010', ('P1', 'C'), ('9', 'C'), ('securityHeaders, csp', 'C'), ('1 j', 'C')],
        ['P2 quick wins', ('P2', 'C'), ('10', 'C'), ('imageDomains, seedOnce', 'C'), ('2 j', 'C')],
    ],
    col_ratios=[0.13, 0.10, 0.10, 0.42, 0.10]
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "<i>Tableau 1 — Cartographie des chapitres du Volume 2 avec efforts estimés et helpers livrés.</i>",
    sMeta
))
story.append(Spacer(1, 14))

story.extend(h2("1.2 Prérequis et conventions"))

story.append(body(
    "Avant d'entamer l'implémentation, l'équipe doit s'assurer que "
    "l'environnement de travail satisfait les prérequis suivants. Tous les "
    "snippets supposent une version de Node supérieure ou égale à 20, un "
    "package manager unifié (pnpm de préférence, npm sinon), et un accès en "
    "écriture au dépôt GitHub du projet. Les dépendances externes "
    "(Upstash Redis, Sentry, Argon2) doivent faire l'objet d'une commande "
    "d'abonnement préalable et de l'ajout des secrets associés dans le "
    "fichier <font name='DejaVuSansMono'>.env.local</font> puis dans le "
    "coffre-fort de secrets de la plateforme de déploiement."
))

story.append(checklist([
    "Node.js ≥ 20.11 LTS installé et activé par défaut via nvm",
    "pnpm ≥ 9 installé globalement (<font name='DejaVuSansMono'>npm i -g pnpm</font>)",
    "Compte Upstash Redis créé, URL + Token récupérés",
    "Variables d'environnement NEXTAUTH_SECRET et DATABASE_URL définies en local",
    "Branche <font name='DejaVuSansMono'>main</font> protégée, branche <font name='DejaVuSansMono'>audit-fixes</font> créée",
    "Pipeline CI GitHub Actions fonctionnelle (lint + build minimum)",
    "Accès administrateur au dashboard de déploiement (Render / Netlify / Vercel)",
]))

story.append(PageBreak())

# ============ CHAPITRE 2 — R-001 Authentification ============
story.extend(h1("2. R-001 — Réécrire l'authentification"))

story.extend(h2("2.1 Objectif"))
story.append(body(
    "Remplacer le compte démo hardcodé par un système d'authentification "
    "réel, sécurisé et configurable. La solution doit supporter à la fois "
    "un provider Credentials (email + mot de passe) pour les utilisateurs "
    "sans compte OAuth, et un provider GitHub pour faciliter l'onboarding "
    "des utilisateurs techniques. Les mots de passe doivent être hachés "
    "avec argon2id — la fonction de hachage recommandée par l'OWASP depuis "
    "2023 — et le secret JWT ne doit plus jamais avoir de valeur de repli "
    "hardcodée. L'authentification doit rester active en développement "
    "pour éviter les divergences de comportement entre environnements."
))

story.extend(h2("2.2 Code actuel problématique"))
story.append(code_block('''// src/lib/auth-config.ts (extrait)
const users = [{
  id: "1",
  email: "demo@hermes.app",
  password: "hermes2024",          // ← en clair, jamais haché
}];

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      credentials: { email: {}, password: {} },
      async authorize(email, password) {
        const user = users.find(u => u.email === email);
        // ← comparaison en clair, sensible à la timing-attack
        if (user && user.password === password) return user;
        return null;
      },
    }),
  ],
  // ← fallback hardcodé : tokens forgeables si NEXTAUTH_SECRET absent
  secret: process.env.NEXTAUTH_SECRET || "hermes-dev-secret-change-in-production",
};''', label='src/lib/auth-config.ts', language='TypeScript'))

story.append(body(
    "Trois défauts critiques sont visibles dans cet extrait. Premièrement, "
    "la liste des utilisateurs est hardcodée dans le source : aucun mécanisme "
    "ne permet d'en ajouter un nouveau sans redéployer l'application. "
    "Deuxièmement, la comparaison <font name='DejaVuSansMono'>user.password === password</font> "
    "est sensible aux attaques temporelles (timing attack) — un attaquant "
    "peut deviner le mot de passe caractère par caractère en mesurant le "
    "temps de réponse. Troisièmement, la valeur de repli pour "
    "<font name='DejaVuSansMono'>NEXTAUTH_SECRET</font> est publique dans le "
    "code source, ce qui permet à quiconque consulte le repo de forger des "
    "sessions valides."
))

story.extend(h2("2.3 Code corrigé"))
story.append(code_block('''// src/lib/auth-config.ts (partie 1/2 — providers)
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import argon2 from "argon2";
import { prisma } from "@/lib/db";

const REQUIRED = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Variable d'environnement manquante: ${key}`);
  return v;
};

export const authOptions: NextAuthOptions = {
  secret: REQUIRED("NEXTAUTH_SECRET"),   // pas de fallback
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 j
  providers: [
    GitHubProvider({
      clientId: REQUIRED("GITHUB_CLIENT_ID"),
      clientSecret: REQUIRED("GITHUB_CLIENT_SECRET"),
    }),
    CredentialsProvider({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: creds.email.toLowerCase() },
        });
        if (!user || !user.passwordHash) return null;
        const ok = await argon2.verify(user.passwordHash, creds.password);
        return ok
          ? { id: user.id, email: user.email, name: user.name }
          : null;
      },
    }),
  ],
  pages: { signIn: "/login" },
};''', label='src/lib/auth-config.ts (1/2)', language='TypeScript'))

story.append(code_block('''// src/lib/auth-config.ts (partie 2/2 — callbacks)
// (à ajouter dans authOptions du fichier précédent)
callbacks: {
  async jwt({ token, user }) {
    // user n'est défini qu'au premier login ; ensuite on lit le token
    if (user) token.uid = user.id;
    return token;
  },
  async session({ session, token }) {
    // Propage l'uid du token vers la session côté client
    if (session.user) session.user.id = token.uid as string;
    return session;
  },
  async signIn({ user, email }) {
    // Liste blanche de domaine pour le provider GitHub
    if (email?.verificationRequest) return true;
    const allowed = process.env.ALLOWED_EMAIL_DOMAINS?.split(",") ?? [];
    if (allowed.length === 0) return true;   // pas de restriction
    const domain = user.email?.split("@")[1];
    return allowed.includes(domain ?? "");
  },
}''', label='src/lib/auth-config.ts (2/2)', language='TypeScript'))

story.extend(h2("2.4 Helper — hashPassword et verifyPassword"))
story.append(body(
    "Centraliser le hachage dans un helper dédié garantit que toute "
    "nouvelle route d'inscription ou de réinitialisation de mot de passe "
    "utilise les mêmes paramètres argon2id. Les valeurs ci-dessous "
    "correspondent aux recommandations OWASP 2024 (mémoire 19 MiB, "
    "parallélisme 1, itérations 2)."
))
story.append(code_block('''// src/lib/password.ts
import argon2 from "argon2";

const OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,  // 19 MiB
  timeCost: 2,            // 2 itérations
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 8) throw new Error("Mot de passe trop court (min 8)");
  return argon2.hash(plain, OPTIONS);
}

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try { return await argon2.verify(hash, plain); }
  catch { return false; }  // hash malformé → refus silencieux
}''', label='src/lib/password.ts', language='TypeScript'))

story.extend(h2("2.5 Helper — requireSession"))
story.append(body(
    "Toutes les routes API doivent récupérer la session via un point "
    "d'entrée unique. Ce helper lève une <font name='DejaVuSansMono'>ApiError</font> "
    "401 si la session est absente, et expose directement l'identifiant "
    "utilisateur — ce qui évite les oublis de vérification dans les routes "
    "individuelles."
))
story.append(code_block('''// src/lib/session.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { ApiError } from "@/lib/api-error";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new ApiError(401, "UNAUTHORIZED", "Session invalide ou expirée");
  }
  return session as {
    user: { id: string; email: string; name?: string | null };
  };
}''', label='src/lib/session.ts', language='TypeScript'))

story.extend(h2("2.6 Protection anti-brute-force"))
story.append(body(
    "Le rate-limit global de 60 req/min est insuffisant pour la route "
    "<font name='DejaVuSansMono'>/api/auth/callback/credentials</font>. Un "
    "attaquant peut tester 60 mots de passe par minute par IP, soit 86 400 "
    "par jour. La protection ci-dessous, à déposer dans "
    "<font name='DejaVuSansMono'>src/lib/auth-rate-limit.ts</font>, utilise "
    "Upstash Redis pour appliquer un seuil de 5 tentatives par 15 minutes "
    "par combinaison IP + email, et verrouille le compte pendant 30 minutes "
    "après le 5ème échec."
))
story.append(code_block('''// src/lib/auth-rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { ApiError } from "@/lib/api-error";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  prefix: "auth:credentials",
});

export async function enforceAuthRateLimit(ip: string, email: string) {
  const key = `${ip}:${email.toLowerCase()}`;
  const { success, reset, remaining } = await limiter.limit(key);
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    throw new ApiError(429, "RATE_LIMITED", "Trop de tentatives", {
      retryAfter,
    });
  }
  return { remaining };
}''', label='src/lib/auth-rate-limit.ts', language='TypeScript'))

story.extend(h2("2.7 Checklist de validation"))
story.append(checklist([
    "Le compte <font name='DejaVuSansMono'>demo@hermes.app</font> est supprimé du code source",
    "<font name='DejaVuSansMono'>NEXTAUTH_SECRET</font> est défini dans tous les environnements (local, staging, prod)",
    "Aucune valeur de repli hardcodée — l'app crash au boot si le secret manque",
    "Tous les mots de passe existants en base sont re-hachés via <font name='DejaVuSansMono'>hashPassword()</font>",
    "La route <font name='DejaVuSansMono'>/api/auth/callback/credentials</font> appelle <font name='DejaVuSansMono'>enforceAuthRateLimit()</font> avant <font name='DejaVuSansMono'>authorize()</font>",
    "Le middleware n'a plus de branche <font name='DejaVuSansMono'>if (process.env.NODE_ENV === 'development') return</font>",
    "Le provider GitHub fonctionne en local via <font name='DejaVuSansMono'>localhost:3000</font>",
    "Les tests E2E couvrent login réussi, login échoué, et verrouillage après 5 tentatives",
]))

story.extend(h2("2.8 Pièges à éviter"))
story.append(pitfall(
    "Ne pas utiliser <font name='DejaVuSansMono'>argon2</font> mais "
    "<font name='DejaVuSansMono'>bcrypt</font> par habitude. Bien que bcrypt "
    "soit encore acceptable, argon2id est désormais le standard recommandé "
    "et résiste mieux aux attaques GPU. De plus, bcrypt limite les mots de "
    "passe à 72 octets, ce qui peut tronquer silencieusement les passphrases."
))
story.append(pitfall(
    "Stocker le hachage dans un champ nommé <font name='DejaVuSansMono'>password</font> "
    "plutôt que <font name='DejaVuSansMono'>passwordHash</font>. Le nom du champ "
    "induit en erreur les contributeurs et peut mener à une fuite accidentelle "
    "si une route API sérialise l'objet User complet par défaut Prisma."
))
story.append(pitfall(
    "Activer le provider GitHub sans restreindre les emails autorisés. "
    "Sans liste blanche de domaine ou vérification d'invitation, n'importe "
    "quel utilisateur GitHub peut créer un compte. Ajouter un check dans le "
    "callback <font name='DejaVuSansMono'>signIn</font> : "
    "<font name='DejaVuSansMono'>if (!email.endsWith('@mondomaine.com')) return false</font>."
))

story.append(PageBreak())

# ============ CHAPITRE 3 — R-002 Multi-tenant ============
story.extend(h1("3. R-002 — Imposer le multi-tenant"))

story.extend(h2("3.1 Objectif"))
story.append(body(
    "Éliminer la constante <font name='DejaVuSansMono'>DEFAULT_USER_ID = \"default\"</font> "
    "utilisée aujourd'hui par l'ensemble des routes API pour écrire et lire "
    "des données. Chaque requête doit dorénavant déduire l'identifiant "
    "utilisateur de la session authentifiée, et toute requête Prisma doit "
    "inclure un filtre <font name='DejaVuSansMono'>where: { userId }</font> "
    "garantissant l'isolation des données entre locataires. La correction "
    "doit être invisible pour le frontend — seul le contrat API change "
    "structurellement (chaque ressource est désormais scopée à un utilisateur)."
))

story.extend(h2("3.2 Code actuel problématique"))
story.append(code_block('''// src/lib/db.ts (extrait problématique)
export const DEFAULT_USER_ID = "default";

export async function ensureDefaultUser() {
  const exists = await prisma.user.findUnique({
    where: { id: "default" },
  });
  if (!exists) {
    await prisma.user.create({
      data: { id: "default", email: "default@hermes.app" },
    });
  }
}

// src/app/api/data/leads/route.ts
import { DEFAULT_USER_ID, ensureDefaultUser } from "@/lib/db";

export async function POST(req: Request) {
  await ensureDefaultUser();
  const body = await req.json();
  const lead = await prisma.lead.create({
    data: { ...body, userId: DEFAULT_USER_ID },  // ← partagé entre tous
  });
  return Response.json(lead);
}''', label='src/lib/db.ts + leads/route.ts', language='TypeScript'))

story.append(body(
    "Le défaut est double. D'une part, <font name='DejaVuSansMono'>DEFAULT_USER_ID</font> "
    "rend l'isolation entre utilisateurs impossible : toutes les données "
    "atterrissent dans le même bac à sable. D'autre part, "
    "<font name='DejaVuSansMono'>ensureDefaultUser()</font> est appelée avant "
    "chaque écriture, ce qui exécute une requête SQL supplémentaire par "
    "appel API — un gaspillage de ressources significatif à l'échelle."
))

story.extend(h2("3.3 Code corrigé"))
story.append(code_block('''// src/lib/db.ts (réécrit)
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development"
    ? ["query", "error", "warn"]
    : ["error", "warn"],
});

// Plus de DEFAULT_USER_ID, plus de ensureDefaultUser().
// Le seeding se fait via prisma/seed.ts exécuté au déploiement.

// src/app/api/data/leads/route.ts (réécrit)
import { requireUser } from "@/lib/session";
import { withErrorHandler } from "@/lib/api-error";
import { prisma } from "@/lib/db";

export const POST = withErrorHandler(async (req: Request) => {
  const userId = await requireUser();           // ← lève 401 si pas de session
  const body = await req.json();

  const lead = await prisma.lead.create({
    data: { ...body, userId },                  // ← isolation par utilisateur
  });
  return Response.json(lead, { status: 201 });
});''', label='src/lib/db.ts + leads/route.ts', language='TypeScript'))

story.extend(h2("3.4 Helper — requireUser"))
story.append(body(
    "Ce helper est le pivot central du multi-tenant. Il encapsule l'appel "
    "à <font name='DejaVuSansMono'>requireSession()</font> et ne renvoie "
    "que l'identifiant utilisateur — pour les routes qui n'ont pas besoin "
    "de l'email ou du nom. Son usage doit devenir systématique dans "
    "chaque handler de route API."
))
story.append(code_block('''// src/lib/session.ts (extension)
import { requireSession } from "@/lib/session";

export async function requireUser(): Promise<string> {
  const session = await requireSession();
  return session.user.id;
}''', label='src/lib/session.ts', language='TypeScript'))

story.extend(h2("3.5 Helper — tenantGuard pour les lectures"))
story.append(body(
    "Le risque le plus subtil du multi-tenant concerne les lectures par "
    "identifiant : <font name='DejaVuSansMono'>findUnique({ where: { id } })</font> "
    "ne filtre pas par utilisateur. Un utilisateur A qui devine l'UUID d'un "
    "lead appartenant à B peut le récupérer. Le helper ci-dessous force la "
    "vérification d'appartenance après chaque lecture par identifiant."
))
story.append(code_block('''// src/lib/tenant-guard.ts
import { ApiError } from "@/lib/api-error";

/**
 * Vérifie qu'une ressource appartient bien à l'utilisateur courant.
 * À utiliser après tout findUnique par ID.
 */
export function assertOwnership<T extends { userId: string }>(
  resource: T | null,
  userId: string,
): T {
  if (!resource) {
    throw new ApiError(404, "NOT_FOUND", "Ressource introuvable");
  }
  if (resource.userId !== userId) {
    // 404 plutôt que 403 pour ne pas confirmer l'existence de la ressource
    throw new ApiError(404, "NOT_FOUND", "Ressource introuvable");
  }
  return resource;
}

// Utilisation :
// const lead = await prisma.lead.findUnique({ where: { id } });
// assertOwnership(lead, userId);''', label='src/lib/tenant-guard.ts', language='TypeScript'))

story.extend(h2("3.6 Migration des routes existantes"))
story.append(body(
    "Le codebase compte une trentaine de routes API à migrer. Plutôt que "
    "de tout réécrire en une fois, adopter une approche incrémentale : "
    "une route par pull request, avec un test d'intrusion simple. "
    "L'audit a identifié les routes ci-dessous comme prioritaires car "
    "elles exposent des données personnelles ou stratégiques."
))
story.append(make_table(
    header=['Route', 'Ressource', 'Sensibilité', 'Difficulté'],
    rows=[
        ['/api/data/leads', 'Leads B2B', ('Critique', 'C'), ('Triviale', 'C')],
        ['/api/data/contacts', 'Contacts email/tél', ('Critique', 'C'), ('Triviale', 'C')],
        ['/api/data/deals', 'Pipelines commerciaux', ('Élevée', 'C'), ('Triviale', 'C')],
        ['/api/data/email-messages', 'Corps d\'emails', ('Critique', 'C'), ('Moyenne', 'C')],
        ['/api/data/workflows', 'Workflows & rules', ('Élevée', 'C'), ('Moyenne', 'C')],
        ['/api/linkedin/feed', 'Posts LinkedIn', ('Moyenne', 'C'), ('Moyenne', 'C')],
        ['/api/data/notifications', 'Notifications', ('Faible', 'C'), ('Triviale', 'C')],
        ['/api/data/feedback', 'Feedback rules', ('Faible', 'C'), ('Triviale', 'C')],
    ],
    col_ratios=[0.28, 0.32, 0.20, 0.20]
))
story.append(Spacer(1, 14))

story.extend(h2("3.7 Test d'intrusion multi-tenant"))
story.append(body(
    "Pour chaque route migrée, ajouter un test automatisé vérifiant "
    "l'isolation. Le pattern ci-dessous crée deux utilisateurs, crée une "
    "ressource pour l'utilisateur A, puis tente d'y accéder avec la session "
    "de B — le test doit échouer avec un 404."
))
story.append(code_block('''// tests/integration/tenant-isolation.test.ts
import { describe, it, expect } from "vitest";
import { createTestUser, createTestSession } from "../helpers/test-harness";

describe("Isolation multi-tenant", () => {
  it("utilisateur B ne peut pas lire le lead de utilisateur A", async () => {
    const userA = await createTestUser({ email: "a@test.local" });
    const userB = await createTestUser({ email: "b@test.local" });

    // A crée un lead
    const sessionA = await createTestSession(userA);
    const createRes = await fetch(`${API}/api/data/leads`, {
      method: "POST",
      headers: { Cookie: sessionA.cookie },
      body: JSON.stringify({ name: "Lead secret", company: "ACME" }),
    });
    const { id: leadId } = await createRes.json();

    // B tente de le lire
    const sessionB = await createTestSession(userB);
    const readRes = await fetch(`${API}/api/data/leads/${leadId}`, {
      headers: { Cookie: sessionB.cookie },
    });

    expect(readRes.status).toBe(404);
  });
});''', label='tests/integration/tenant-isolation.test.ts', language='TypeScript'))

story.extend(h2("3.8 Checklist de validation"))
story.append(checklist([
    "La constante <font name='DejaVuSansMono'>DEFAULT_USER_ID</font> n'existe plus dans le code",
    "La fonction <font name='DejaVuSansMono'>ensureDefaultUser()</font> est supprimée (remplacée par <font name='DejaVuSansMono'>prisma db seed</font>)",
    "Toutes les routes API appellent <font name='DejaVuSansMono'>requireUser()</font> en première ligne",
    "Tous les <font name='DejaVuSansMono'>findUnique({ where: { id } })</font> sont suivis de <font name='DejaVuSansMono'>assertOwnership()</font>",
    "Le test <font name='DejaVuSansMono'>tenant-isolation.test.ts</font> passe pour les 8 routes prioritaires",
    "Le schéma Prisma comporte un index <font name='DejaVuSansMono'>@@index([userId])</font> sur chaque table métier",
    "Aucune route ne renvoie 200 pour une ressource appartenant à un autre utilisateur",
]))

story.extend(h2("3.9 Pièges à éviter"))
story.append(pitfall(
    "Utiliser <font name='DejaVuSansMono'>findUnique({ where: { id, userId } })</font> "
    "pour vérifier l'appartenance en une seule requête. Bien que séduisante, "
    "cette approche masque la distinction entre « ressource inexistante » et "
    "« ressource appartenant à autrui ». En cas de bug, le debugging devient "
    "impossible. Toujours séparer les deux opérations."
))
story.append(pitfall(
    "Oublier les routes <font name='DejaVuSansMono'>/api/data/export</font> et "
    "<font name='DejaVuSansMono'>/api/data/import</font> lors de la migration. "
    "Ces routes batch touchent l'intégralité des données utilisateur et sont "
    "parfaites pour exfiltrer massivement. Elles doivent impérativement "
    "filtrer par <font name='DejaVuSansMono'>userId</font> dans la clause "
    "<font name='DejaVuSansMono'>where</font> de l'export."
))
story.append(pitfall(
    "Conserver un cache in-memory dans un moteur (workflow-engine, "
    "notification-engine) sans clé <font name='DejaVuSansMono'>userId</font>. "
    "Si le cache est global, un utilisateur A peut récupérer les données "
    "de B via le cache. Toujours préfixer la clé de cache par "
    "<font name='DejaVuSansMono'>userId</font> ou supprimer le cache."
))

story.append(PageBreak())

# ============ CHAPITRE 4 — R-003 Build strict ============
story.extend(h1("4. R-003 — Désactiver ignoreBuildErrors"))

story.extend(h2("4.1 Objectif"))
story.append(body(
    "Supprimer la directive <font name='DejaVuSansMono'>typescript: { ignoreBuildErrors: true }</font> "
    "de <font name='DejaVuSansMono'>next.config.ts</font>. Cette directive "
    "produit un bundle de production même lorsque le compilateur TypeScript "
    "détecte des erreurs de types — ce qui masque des bugs silencieux. "
    "L'opération s'effectue en deux temps : corriger les erreurs existantes, "
    "puis ajouter une étape CI qui empêche toute régression. L'objectif "
    "secondaire est de réduire le nombre de <font name='DejaVuSansMono'>any</font> "
    "(87 occurrences sur 30 fichiers) en les remplaçant par des types "
    "explicites ou <font name='DejaVuSansMono'>unknown</font> avec narrowing."
))

story.extend(h2("4.2 Code actuel problématique"))
story.append(code_block('''// next.config.ts (extrait)
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,   // ← masque toutes les erreurs TS
  },
  eslint: {
    ignoreDuringBuilds: true,  // ← masque aussi les warnings ESLint
  },
  images: {
    unoptimized: true,         // ← traité chapitre 10
  },
};''', label='next.config.ts', language='TypeScript'))

story.extend(h2("4.3 Code corrigé"))
story.append(code_block('''// next.config.ts (réécrit)
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plus de ignoreBuildErrors : le build échoue si tsc ou eslint
  // détecte une erreur. C'est le comportement attendu.
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "media.licdn.com" },
    ],
  },
  // Headers de sécurité globaux (complétés par middleware.ts)
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default nextConfig;''', label='next.config.ts (réécrit)', language='TypeScript'))

story.extend(h2("4.4 Helper — narrowUnknown"))
story.append(body(
    "Le remplacement des <font name='DejaVuSansMono'>any</font> par "
    "<font name='DejaVuSansMono'>unknown</font> oblige à valider le type "
    "avant usage. Le helper <font name='DejaVuSansMono'>narrowUnknown()</font> "
    "centralise ce pattern via une fonction de garde réutilisable. Il "
    "remplace avantageusement les casts <font name='DejaVuSansMono'>as any</font> "
    "ou <font name='DejaVuSansMono'>as unknown as Type</font> qui sont des "
    "portes d'entrée pour des bugs silencieux."
))
story.append(code_block('''// src/lib/type-guards.ts
import { ZodSchema, ZodError } from "zod";

/**
 * Valide une valeur inconnue contre un schéma Zod.
 * Lance une ApiError 400 si la validation échoue.
 */
export function narrowUnknown<T>(
  value: unknown,
  schema: ZodSchema<T>,
  label = "payload",
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Validation ${label} failed: ${issues}`);
  }
  return result.data;
}

// Utilisation :
// import { z } from "zod";
// const LeadSchema = z.object({
//   name: z.string().min(1),
//   company: z.string().optional(),
//   email: z.string().email().optional(),
// });
// const lead = narrowUnknown(body, LeadSchema, "lead");''', label='src/lib/type-guards.ts', language='TypeScript'))

story.extend(h2("4.5 Workflow de correction des 87 any"))
story.append(body(
    "L'audit a identifié 87 occurrences de <font name='DejaVuSansMono'>any</font> "
    "réparties sur 30 fichiers. Plutôt que de tout corriger en une fois, "
    "adopter une stratégie par paliers : traiter d'abord les fichiers "
    "<font name='DejaVuSansMono'>src/lib</font> (impact runtime direct), "
    "ensuite les routes API, enfin les composants UI. Pour chaque fichier, "
    "utiliser la commande <font name='DejaVuSansMono'>rg \"\\\\bany\\\\b\" --type ts</font> "
    "pour lister les occurrences, puis remplacer selon l'arbre de décision ci-dessous."
))
story.append(make_table(
    header=['Type de any', 'Fréquence', 'Stratégie', 'Effort unitaire'],
    rows=[
        ['any sur params de fonction', ('32%', 'C'), ('Définir un type dédié ou unknown + Zod', 'C'), ('15 min', 'C')],
        ['any sur retour de fetch()', ('24%', 'C'), ('Schéma Zod + narrowUnknown', 'C'), ('10 min', 'C')],
        ['any sur callback (Promise, event)', ('18%', 'C'), ('Type générique ou interface callback', 'C'), ('8 min', 'C')],
        ['any sur props composant React', ('14%', 'C'), ('Définir Props interface', 'C'), ('5 min', 'C')],
        ['any légitime (catch error)', ('12%', 'C'), ('Remplacer par unknown + instanceof', 'C'), ('3 min', 'C')],
    ],
    col_ratios=[0.32, 0.13, 0.40, 0.15]
))
story.append(Spacer(1, 14))

story.extend(h2("4.6 CI — Gate TypeScript"))
story.append(body(
    "Ajouter une étape CI obligatoire qui exécute "
    "<font name='DejaVuSansMono'>tsc --noEmit</font> sur chaque pull request. "
    "Cette étape doit bloquer la fusion si le compilateur détecte une erreur. "
    "Combinée à la suppression de <font name='DejaVuSansMono'>ignoreBuildErrors</font>, "
    "elle garantit qu'aucune régression de type ne peut atteindre la branche principale."
))
story.append(code_block('''# .github/workflows/ci.yml (extrait)
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec tsc --noEmit
      - run: pnpm lint
      - run: pnpm test --coverage
      - name: Couverture minimale
        run: |
          COV=$(pnpm exec c8 report --reporter=text-summary | grep "Lines" | awk '{print $2}' | tr -d '%')
          if [ "$COV" -lt 50 ]; then
            echo "Coverage $COV% < 50% — bloqué"
            exit 1
          fi''', label='.github/workflows/ci.yml', language='YAML'))

story.extend(h2("4.7 Checklist de validation"))
story.append(checklist([
    "La directive <font name='DejaVuSansMono'>ignoreBuildErrors</font> est supprimée de next.config.ts",
    "La directive <font name='DejaVuSansMono'>ignoreDuringBuilds</font> (ESLint) est également supprimée",
    "<font name='DejaVuSansMono'>npx tsc --noEmit</font> ne renvoie aucune erreur",
    "<font name='DejaVuSansMono'>npx next build</font> réussit sans warning ni error",
    "L'étape <font name='DejaVuSansMono'>typecheck</font> est active dans la CI et bloque les PR",
    "Le nombre de <font name='DejaVuSansMono'>any</font> est descendu sous 20 (cible initiale)",
    "Aucun nouveau <font name='DejaVuSansMono'>any</font> n'est introduit (vérifié par un lint rule custom)",
]))

story.extend(h2("4.8 Pièges à éviter"))
story.append(pitfall(
    "Activer <font name='DejaVuSansMono'>strict: true</font> dans tsconfig "
    "d'un seul coup. Le mode strict active 7 vérifications distinctes "
    "(noImplicitAny, strictNullChecks, etc.) qui produiront des centaines "
    "d'erreurs d'un coup. Activer les vérifications une par une, dans "
    "l'ordre : <font name='DejaVuSansMono'>noImplicitReturns</font> → "
    "<font name='DejaVuSansMono'>noFallthroughCasesInSwitch</font> → "
    "<font name='DejaVuSansMono'>strictNullChecks</font> → reste."
))
story.append(pitfall(
    "Remplacer un <font name='DejaVuSansMono'>any</font> par "
    "<font name='DejaVuSansMono'>unknown</font> sans ajout de garde. Cela "
    "déplace le problème : le code compile, mais le runtime peut casser si "
    "la valeur n'a pas la forme attendue. Toujours accompagner "
    "<font name='DejaVuSansMono'>unknown</font> d'un schéma Zod ou d'une "
    "garde explicite."
))
story.append(pitfall(
    "Activer <font name='DejaVuSansMono'>reactStrictMode: true</font> sans "
    "auditer les <font name='DejaVuSansMono'>useEffect</font> existants. Le "
    "mode strict double les effets en développement, ce qui peut révéler "
    "des effets de bord cachés (double appel API, double inscription "
    "WebSocket). Vérifier chaque useEffect avant de déployer."
))

story.append(PageBreak())

# ============ CHAPITRE 5 — R-004 & R-005 Base de données ============
story.extend(h1("5. R-004 & R-005 — Aligner schéma et logs Prisma"))

story.extend(h2("5.1 Objectif"))
story.append(body(
    "Résoudre deux défauts corrélés : l'incohérence entre le provider "
    "PostgreSQL déclaré dans le schéma Prisma et la chaîne SQLite utilisée "
    "à l'exécution, et la verbosité excessive des logs Prisma en production "
    "(<font name='DejaVuSansMono'>log: ['query']</font> génère une ligne par "
    "requête SQL). Le chapitre livre également le script de migration "
    "versionnée et la procédure de suppression de la fonction "
    "<font name='DejaVuSansMono'>ensureDefaultUser()</font> déjà traitée au "
    "chapitre 3."
))

story.extend(h2("5.2 Code actuel problématique"))
story.append(before_after(
'''// prisma/schema.prisma
datasource db {
  provider = "postgresql"   // ← déclaré PG
  url      = env("DATABASE_URL")
}

// src/lib/db.ts
new PrismaClient({
  log: ["query", "error", "warn"],  // ← log:query en prod
});

// .env
DATABASE_URL="file:./db/custom.db"  // ← SQLite !''',
'''// prisma/schema.prisma
datasource db {
  provider = "sqlite"      // ← aligné sur DATABASE_URL
  url      = env("DATABASE_URL")
}

// src/lib/db.ts
new PrismaClient({
  log: process.env.NODE_ENV === "development"
    ? ["query", "error", "warn"]
    : ["error", "warn"],   // ← silence en prod
});

// .env
DATABASE_URL="file:./db/custom.db"  // ← inchangé''',
    before_label='Avant',
    after_label='Après'
))

story.append(body(
    "L'incohérence provider PG / runtime SQLite est silencieuse en "
    "développement car Prisma adapte dynamiquement le dialecte. Mais "
    "certaines fonctionnalités avancées (JSON indexé, arrays, enums "
    "PostgreSQL) échoueront en production si une migration vers PostgreSQL "
    "a lieu sans ajustement du schéma. La correction la plus simple à court "
    "terme est d'aligner le provider sur SQLite. Une migration vers "
    "PostgreSQL est recommandée à moyen terme (chapitre 5.6)."
))

story.extend(h2("5.3 Migration versionnée"))
story.append(body(
    "Remplacer l'usage de <font name='DejaVuSansMono'>prisma db push</font> "
    "(qui ne versionne pas les migrations) par <font name='DejaVuSansMono'>prisma migrate</font>. "
    "Cette commande génère un fichier SQL horodaté dans "
    "<font name='DejaVuSansMono'>prisma/migrations/</font> qui peut être "
    "rejoué sur n'importe quel environnement. Le script ci-dessous "
    "automatise la première migration depuis un schéma existant."
))
story.append(code_block('''#!/usr/bin/env bash
# scripts/prisma-migrate-init.sh
set -euo pipefail

echo "→ Création de la migration initiale..."
pnpm exec prisma migrate dev --name init --create-only

echo "→ Vérification du SQL généré..."
ls -la prisma/migrations/

echo "→ Application de la migration..."
pnpm exec prisma migrate dev

echo "→ Génération du client Prisma..."
pnpm exec prisma generate

echo "→ Seed initial..."
pnpm exec prisma db seed

echo "✓ Migration initiale terminée"''', label='scripts/prisma-migrate-init.sh', language='Bash'))

story.extend(h2("5.4 Helper — prismaLog"))
story.append(body(
    "Plutôt que d'inliner la condition ternaire dans chaque instantiation "
    "Prisma, le helper <font name='DejaVuSansMono'>prismaLog()</font> centralise "
    "la logique et facilite un ajustement ultérieur (par exemple ajouter "
    "un niveau <font name='DejaVuSansMono'>info</font> en staging)."
))
story.append(code_block('''// src/lib/prisma-log.ts
import type { PrismaClientOptions } from "@prisma/client";

export function prismaLog(): PrismaClientOptions["log"] {
  if (process.env.NODE_ENV === "development") {
    return ["query", "error", "warn"];
  }
  if (process.env.NODE_ENV === "test") {
    return ["error"];   // silence total en test
  }
  return ["error", "warn"];   // production
}

// Utilisation :
// import { prismaLog } from "@/lib/prisma-log";
// export const prisma = new PrismaClient({ log: prismaLog() });''', label='src/lib/prisma-log.ts', language='TypeScript'))

story.extend(h2("5.5 Seed unique au déploiement"))
story.append(body(
    "Supprimer la fonction <font name='DejaVuSansMono'>ensureDefaultUser()</font> "
    "appelée à chaque écriture (voir chapitre 3) et la remplacer par un seed "
    "exécuté une seule fois au déploiement. Le script ci-dessous crée un "
    "utilisateur admin initial à partir de variables d'environnement, et "
    "ajoute les règles de feedback par défaut."
))
story.append(code_block('''// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn("ADMIN_EMAIL/ADMIN_PASSWORD manquants — skip seed admin");
  } else {
    const exists = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    if (!exists) {
      await prisma.user.create({
        data: {
          email: adminEmail,
          name: "Admin",
          passwordHash: await hashPassword(adminPassword),
          role: "ADMIN",
        },
      });
      console.log(`✓ Admin ${adminEmail} créé`);
    }
  }

  // Règles de feedback par défaut
  await prisma.feedbackRule.upsert({
    where: { id: "default-positive" },
    create: { id: "default-positive", pattern: "merci|super|génial", action: "BOOST" },
    update: {},
  });

  console.log("✓ Seed terminé");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });''', label='prisma/seed.ts', language='TypeScript'))

story.extend(h2("5.6 Migration future vers PostgreSQL"))
story.append(body(
    "À moyen terme (semaines 7 à 9 de la roadmap), il est recommandé de "
    "migrer vers PostgreSQL pour bénéficier des fonctionnalités absentes "
    "de SQLite : transactions concurrentes, JSON indexé, arrays, "
    "recherche full-text, extensions (pg_trgm, PostGIS). La procédure "
    "consiste à : (1) provisionner une instance PostgreSQL managée "
    "(Neon, Supabase ou RDS), (2) modifier "
    "<font name='DejaVuSansMono'>prisma/schema.prisma</font> pour repasser "
    "le provider à <font name='DejaVuSansMono'>postgresql</font>, (3) ajuster "
    "les types spécifiques (par exemple <font name='DejaVuSansMono'>String</font> "
    "→ <font name='DejaVuSansMono'>String @db.Text</font> pour les corps "
    "d'email), (4) générer une nouvelle migration, (5) exécuter un script "
    "de transfert de données SQLite → PostgreSQL."
))

story.extend(h2("5.7 Checklist de validation"))
story.append(checklist([
    "Le provider Prisma correspond au schéma de DATABASE_URL",
    "<font name='DejaVuSansMono'>log: ['query']</font> est désactivé en production",
    "<font name='DejaVuSansMono'>prisma/migrations/</font> contient au moins une migration versionnée",
    "<font name='DejaVuSansMono'>prisma db push</font> n'est plus utilisé dans le workflow",
    "Le fichier <font name='DejaVuSansMono'>prisma/seed.ts</font> est exécutable via <font name='DejaVuSansMono'>pnpm exec prisma db seed</font>",
    "La commande <font name='DejaVuSansMono'>prisma db seed</font> est ajoutée au script de post-déploiement",
    "<font name='DejaVuSansMono'>ensureDefaultUser()</font> est supprimée du code applicatif",
    "Les logs en production ne contiennent plus de lignes <font name='DejaVuSansMono'>prisma:query</font>",
]))

story.extend(h2("5.8 Pièges à éviter"))
story.append(pitfall(
    "Oublier de supprimer le fichier <font name='DejaVuSansMono'>db/custom.db</font> "
    "après migration vers PostgreSQL. Le fichier reste présent mais "
    "inutilisé, ce qui peut induire en erreur un développeur pensant que "
    "SQLite est encore actif. Le supprimer et ajouter une entrée "
    "<font name='DejaVuSansMono'>db/*.db</font> dans <font name='DejaVuSansMono'>.gitignore</font>."
))
story.append(pitfall(
    "Mixer <font name='DejaVuSansMono'>prisma db push</font> et "
    "<font name='DejaVuSansMono'>prisma migrate</font> dans le workflow. "
    "<font name='DejaVuSansMono'>db push</font> ne crée pas de migration "
    "et peut laisser le schéma en base désynchronisé des migrations "
    "versionnées. Standardiser sur <font name='DejaVuSansMono'>migrate dev</font> "
    "en développement et <font name='DejaVuSansMono'>migrate deploy</font> en production."
))
story.append(pitfall(
    "Exécuter le seed en production sans idempotence. Si le script ne "
    "vérifie pas l'existence préalable, il échouera sur une contrainte "
    "unique au second déploiement. Toujours utiliser "
    "<font name='DejaVuSansMono'>upsert()</font> ou vérifier avec "
    "<font name='DejaVuSansMono'>findUnique()</font> avant <font name='DejaVuSansMono'>create()</font>."
))

story.append(PageBreak())

# ============ CHAPITRE 6 — R-007 Rate-limit distribué ============
story.extend(h1("6. R-007 — Rate-limit distribué"))

story.extend(h2("6.1 Objectif"))
story.append(body(
    "Remplacer le rate-limit in-memory actuel — basé sur "
    "<font name='DejaVuSansMono'>Map&lt;string, ...&gt;</font> — par un "
    "rate-limit distribué s'appuyant sur Upstash Redis. La solution doit "
    "fonctionner en multi-instance (Render, Netlify Functions, conteneurs "
    "Kubernetes), supporter des seuils différenciés par catégorie de route, "
    "et exposer les en-têtes standard <font name='DejaVuSansMono'>X-RateLimit-*</font> "
    "pour permettre aux clients d'adapter leur cadence."
))

story.extend(h2("6.2 Code actuel problématique"))
story.append(code_block('''// src/middleware.ts (extrait)
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, lastReset: now });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}''', label='src/middleware.ts', language='TypeScript'))

story.append(body(
    "Trois défauts : (1) la Map est privée à chaque instance, donc en "
    "multi-instance le seuil effectif est multiplié par le nombre "
    "d'instances ; (2) le seuil unique de 60 req/min est trop généreux "
    "pour <font name='DejaVuSansMono'>/api/auth/*</font> et trop strict "
    "pour les routes de lecture agrégées ; (3) la Map grandit indéfiniment "
    "(pas de garbage collection des IPs anciennes), ce qui constitue une "
    "fuite mémoire à long terme."
))

story.extend(h2("6.3 Helper — rateLimiters par catégorie"))
story.append(code_block('''// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// Catégories de routes avec seuils différenciés
const buildLimiter = (max: number, window: string, prefix: string) =>
  new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, window),
    prefix,
    analytics: true,
  });

export const rateLimiters = {
  auth:     buildLimiter(5,   "15 m", "rl:auth"),      // login, signup
  write:    buildLimiter(30,  "1 m",  "rl:write"),     // POST/PUT/DELETE
  read:     buildLimiter(120, "1 m",  "rl:read"),      // GET agrégés
  ai:       buildLimiter(10,  "1 m",  "rl:ai"),        // chat, generate
  linkedin: buildLimiter(20,  "1 m",  "rl:linkedin"),  // API LinkedIn
  export:   buildLimiter(3,   "1 h",  "rl:export"),    // bulk export
};

export type RateLimitCategory = keyof typeof rateLimiters;

export async function enforceRateLimit(
  category: RateLimitCategory,
  identifier: string,
): Promise<{ remaining: number; reset: number }> {
  const limiter = rateLimiters[category];
  const { success, remaining, reset } = await limiter.limit(identifier);
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return { remaining: 0, reset: retryAfter };
  }
  return { remaining, reset };
}''', label='src/lib/rate-limit.ts', language='TypeScript'))

story.extend(h2("6.4 Wrapper — applyRateLimit"))
story.append(body(
    "Plutôt que d'injecter le rate-limit dans chaque route individuellement, "
    "le wrapper <font name='DejaVuSansMono'>applyRateLimit()</font> "
    "s'enroule autour du handler et applique le bon limitateur selon la "
    "catégorie. Il injecte également les en-têtes "
    "<font name='DejaVuSansMono'>X-RateLimit-Remaining</font> et "
    "<font name='DejaVuSansMono'>Retry-After</font> dans la réponse."
))
story.append(code_block('''// src/lib/rate-limit-wrapper.ts
import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, RateLimitCategory } from "@/lib/rate-limit";

export function applyRateLimit(
  category: RateLimitCategory,
  handler: (req: NextRequest, ctx: { userId?: string }) => Promise<Response>,
) {
  return async (req: NextRequest): Promise<Response> => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]
            || req.headers.get("x-real-ip")
            || "unknown";

    const { remaining, reset } = await enforceRateLimit(category, ip);

    if (remaining === 0) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Trop de requêtes" } },
        {
          status: 429,
          headers: {
            "Retry-After": String(reset),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Limit": String(category),
          },
        },
      );
    }

    const res = await handler(req, {});
    res.headers.set("X-RateLimit-Remaining", String(remaining));
    return res;
  };
}

// Utilisation :
// export const POST = applyRateLimit("write", async (req) => { ... });
// export const GET = applyRateLimit("read", async (req) => { ... });''',
    label='src/lib/rate-limit-wrapper.ts', language='TypeScript'))

story.extend(h2("6.5 Tableau des seuils par catégorie"))
story.append(make_table(
    header=['Catégorie', 'Routes', 'Limite', 'Window', 'Justification'],
    rows=[
        ['auth', '/api/auth/*', ('5', 'C'), ('15 min', 'C'), 'Anti-brute-force'],
        ['write', 'POST/PUT/DELETE /api/data/*', ('30', 'C'), ('1 min', 'C'), 'Charge utile Prisma'],
        ['read', 'GET /api/data/*', ('120', 'C'), ('1 min', 'C'), 'UI déroule des listes'],
        ['ai', '/api/ai/*', ('10', 'C'), ('1 min', 'C'), 'Coût OpenAI/Anthropic'],
        ['linkedin', '/api/linkedin/*', ('20', 'C'), ('1 min', 'C'), 'Quota API LinkedIn'],
        ['export', '/api/data/export', ('3', 'C'), ('1 h', 'C'), 'Requêtes lourdes'],
    ],
    col_ratios=[0.13, 0.32, 0.10, 0.15, 0.30]
))
story.append(Spacer(1, 14))

story.extend(h2("6.6 Fallback en cas d'indisponibilité Redis"))
story.append(body(
    "Si Upstash Redis est indisponible (panne réseau, quota dépassé), "
    "l'application doit continuer à fonctionner en mode dégradé. Le "
    "fallback ci-dessous bascule sur un rate-limit local "
    "(instance-courante) et logge un warning. Cela garantit que la "
    "disponibilité de l'app n'est pas couplée à celle de Redis."
))
story.append(code_block('''// src/lib/rate-limit-fallback.ts
import { Ratelimit } from "@upstash/ratelimit";

// Rate-limit local (instance unique) — fallback si Redis down
const localLimiter = new Ratelimit({
  // @ts-expect-error — Ratelimit supporte un store local
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "rl:local",
  analytics: false,
});

export async function safeRateLimit(
  category: string,
  ip: string,
): Promise<{ success: boolean; remaining: number; reset: number }> {
  try {
    // Tentative Redis d'abord
    const { enforceRateLimit } = await import("@/lib/rate-limit");
    const r = await enforceRateLimit(category as any, ip);
    return { success: r.remaining > 0, ...r };
  } catch (e) {
    console.warn("[rate-limit] Redis down, fallback local:", e);
    const r = await localLimiter.limit(`${category}:${ip}`);
    return { success: r.success, remaining: r.remaining, reset: r.reset };
  }
}''', label='src/lib/rate-limit-fallback.ts', language='TypeScript'))

story.extend(h2("6.7 Checklist de validation"))
story.append(checklist([
    "Upstash Redis est provisionné (URL + Token dans <font name='DejaVuSansMono'>.env</font>)",
    "La Map <font name='DejaVuSansMono'>rateLimitMap</font> est supprimée du middleware",
    "Chaque route API est wrappée par <font name='DejaVuSansMono'>applyRateLimit()</font>",
    "Les en-têtes <font name='DejaVuSansMono'>X-RateLimit-Remaining</font> sont présents dans les réponses",
    "Un test simule 100 appels en rafale sur <font name='DejaVuSansMono'>/api/auth/*</font> et vérifie le 429",
    "Le fallback local fonctionne quand Redis est volontairement coupé",
    "Le dashboard Upstash affiche l'utilisation réelle des limitateurs",
]))

story.extend(h2("6.8 Pièges à éviter"))
story.append(pitfall(
    "Utiliser l'IP brute comme identifiant de rate-limit. Plusieurs "
    "utilisateurs légitimes peuvent partager une IP (NAT d'entreprise, "
    "VPN, mobile). Combiner IP + identifiant utilisateur authentifié "
    "pour éviter les faux positifs : <font name='DejaVuSansMono'>"
    "`${ip}:${userId ?? 'anon'}`</font>."
))
story.append(pitfall(
    "Oublier de configurer <font name='DejaVuSansMono'>UPSTASH_REDIS_URL</font> "
    "et <font name='DejaVuSansMono'>UPSTASH_REDIS_TOKEN</font> en production. "
    "Sans ces variables, le rate-limit plantera silencieusement (sauf si le "
    "fallback du chapitre 6.6 est en place). Toujours tester le démarrage "
    "avec Redis down pour valider le fallback."
))
story.append(pitfall(
    "Choisir le mauvais algorithme. <font name='DejaVuSansMono'>fixedWindow</font> "
    "autorise 2× la limite aux frontières de fenêtre (60 req à 11:59 + 60 req "
    "à 12:00 = 120 req en 1 minute). Préférer <font name='DejaVuSansMono'>slidingWindow</font> "
    "qui lisse les transitions."
))

story.append(PageBreak())

# ============ CHAPITRE 7 — R-008 Gestion d'erreurs API ============
story.extend(h1("7. R-008 — Gestion d'erreurs API unifiée"))

story.extend(h2("7.1 Objectif"))
story.append(body(
    "Créer un wrapper <font name='DejaVuSansMono'>withErrorHandler()</font> "
    "qui emballe systématiquement le handler de chaque route API. Le "
    "wrapper capture les erreurs Prisma connues et renvoie un format JSON "
    "normalisé <font name='DejaVuSansMono'>{ error: { code, message, details? } }</font>, "
    "avec les codes HTTP appropriés. Il logge les erreurs 500 avec un "
    "identifiant de corrélation et ne divulgue jamais le message Prisma "
    "brut en production."
))

story.extend(h2("7.2 Code actuel problématique"))
story.append(code_block('''// src/app/api/data/leads/route.ts (actuel)
export async function POST(req: Request) {
  const body = await req.json();
  const lead = await prisma.lead.create({
    data: { ...body, userId: DEFAULT_USER_ID },
  });
  return Response.json(lead);
}

// Si body.email est en doublon → Prisma lève P2002
// → Next.js renvoie 500 avec le message Prisma en clair
// → le frontend ne sait pas distinguer 400 (client) vs 500 (serveur)''',
    label='src/app/api/data/leads/route.ts', language='TypeScript'))

story.extend(h2("7.3 Helper — ApiError"))
story.append(body(
    "La classe <font name='DejaVuSansMono'>ApiError</font> est le type "
    "d'erreur canonique du projet. Toute erreur métier ou technique doit "
    "être levée comme <font name='DejaVuSansMono'>ApiError</font>, ce qui "
    "permet au wrapper de la convertir en réponse HTTP structurée sans "
    "logique de mapping dispersée dans les routes."
))
story.append(code_block('''// src/lib/api-error.ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static unauthorized(msg = "Non authentifié") {
    return new ApiError(401, "UNAUTHORIZED", msg);
  }
  static forbidden(msg = "Action interdite") {
    return new ApiError(403, "FORBIDDEN", msg);
  }
  static notFound(msg = "Ressource introuvable") {
    return new ApiError(404, "NOT_FOUND", msg);
  }
  static conflict(msg = "Conflit", details?: Record<string, unknown>) {
    return new ApiError(409, "CONFLICT", msg, details);
  }
  static validation(msg: string, details?: Record<string, unknown>) {
    return new ApiError(422, "VALIDATION_ERROR", msg, details);
  }
  static rateLimited(retryAfter: number) {
    return new ApiError(429, "RATE_LIMITED", "Trop de requêtes", { retryAfter });
  }
  static internal(msg = "Erreur interne") {
    return new ApiError(500, "INTERNAL_ERROR", msg);
  }
}''', label='src/lib/api-error.ts', language='TypeScript'))

story.extend(h2("7.4 Helper — withErrorHandler"))
story.append(body(
    "Le wrapper <font name='DejaVuSansMono'>withErrorHandler()</font> "
    "capture les erreurs et les convertit en réponses HTTP. Il gère "
    "trois familles : (1) <font name='DejaVuSansMono'>ApiError</font> "
    "levée explicitement par le code métier ; (2) erreurs Prisma "
    "reconnues (P2002, P2025, etc.) ; (3) autres erreurs (500 générique "
    "avec identifiant de corrélation)."
))
story.append(code_block('''// src/lib/with-error-handler.ts (partie 1/2)
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { randomUUID } from "crypto";

type Handler<T> = (req: Request, ctx: { params?: Record<string, string> }) => Promise<T>;

export function withErrorHandler<T extends Response>(
  handler: Handler<T>,
): Handler<T> {
  return async (req, ctx) => {
    const correlationId = randomUUID();
    try {
      const res = await handler(req, ctx);
      res.headers.set("X-Correlation-Id", correlationId);
      return res;
    } catch (err) {
      // 1. ApiError explicite
      if (err instanceof ApiError) {
        return Response.json(
          { error: { code: err.code, message: err.message, details: err.details } },
          { status: err.status, headers: { "X-Correlation-Id": correlationId } },
        ) as T;
      }
      // 2. Erreurs Prisma connues
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        const mapped = mapPrismaError(err);
        return Response.json(
          { error: mapped },
          { status: mapped.status, headers: { "X-Correlation-Id": correlationId } },
        ) as T;
      }
      // 3. Erreur inattendue → 500 générique + log
      logger.error({
        correlationId,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        url: req.url, method: req.method,
      });
      const isProd = process.env.NODE_ENV === "production";
      return Response.json(
        { error: {
            code: "INTERNAL_ERROR",
            message: isProd ? "Une erreur est survenue"
                          : err instanceof Error ? err.message : String(err),
            correlationId,
          },
        },
        { status: 500, headers: { "X-Correlation-Id": correlationId } },
      ) as T;
    }
  };
}''', label='src/lib/with-error-handler.ts (1/2)', language='TypeScript'))

story.append(code_block('''// src/lib/with-error-handler.ts (partie 2/2 — mapPrismaError)
function mapPrismaError(err: Prisma.PrismaClientKnownRequestError) {
  switch (err.code) {
    case "P2002": // Unique constraint
      return {
        status: 409,
        code: "CONFLICT",
        message: "Cette ressource existe déjà",
        details: { target: err.meta?.target },
      };
    case "P2025": // Record not found
      return { status: 404, code: "NOT_FOUND", message: "Ressource introuvable" };
    case "P2003": // Foreign key
      return {
        status: 400,
        code: "FOREIGN_KEY_VIOLATION",
        message: "Référence invalide",
        details: { field: err.meta?.field_name },
      };
    case "P1001": // DB timeout
      return {
        status: 503,
        code: "DATABASE_UNAVAILABLE",
        message: "Base de données temporairement indisponible",
      };
    default:
      return { status: 500, code: "DATABASE_ERROR", message: "Erreur de base de données" };
  }
}''', label='src/lib/with-error-handler.ts (2/2)', language='TypeScript'))

story.extend(h2("7.5 Utilisation type"))
story.append(before_after(
'''// AVANT
export async function POST(req: Request) {
  const body = await req.json();
  const lead = await prisma.lead.create({
    data: { ...body, userId: DEFAULT_USER_ID },
  });
  return Response.json(lead);
}''',
'''// APRÈS
import { withErrorHandler } from "@/lib/with-error-handler";
import { requireUser } from "@/lib/session";
import { ApiError } from "@/lib/api-error";

export const POST = withErrorHandler(async (req) => {
  const userId = await requireUser();
  const body = await req.json();

  if (!body.name) {
    throw ApiError.validation("Champ name requis", { field: "name" });
  }

  const lead = await prisma.lead.create({
    data: { ...body, userId },
  });
  return Response.json(lead, { status: 201 });
});''',
    before_label='Avant',
    after_label='Après'
))

story.extend(h2("7.6 Format d'erreur normalisé"))
story.append(make_table(
    header=['Code HTTP', 'Code API', 'Quand l\'utiliser', 'Exemple'],
    rows=[
        ['400', 'BAD_REQUEST', ('Payload malformé', 'C'), ('JSON invalide', 'C')],
        ['401', 'UNAUTHORIZED', ('Session absente/expirée', 'C'), ('Token JWT invalide', 'C')],
        ['403', 'FORBIDDEN', ('Action non autorisée', 'C'), ('Modifier lead d\'autrui', 'C')],
        ['404', 'NOT_FOUND', ('Ressource inexistante', 'C'), ('Lead UUID inconnu', 'C')],
        ['409', 'CONFLICT', ('Contrainte unique violée', 'C'), ('Email déjà pris', 'C')],
        ['422', 'VALIDATION_ERROR', ('Schéma Zod invalide', 'C'), ('Email mal formaté', 'C')],
        ['429', 'RATE_LIMITED', ('Quota dépassé', 'C'), ('5 logins / 15 min', 'C')],
        ['500', 'INTERNAL_ERROR', ('Erreur inattendue', 'C'), ('Bug runtime', 'C')],
        ['503', 'DATABASE_UNAVAILABLE', ('DB down', 'C'), ('Prisma P1001', 'C')],
    ],
    col_ratios=[0.10, 0.22, 0.36, 0.32]
))
story.append(Spacer(1, 14))

story.extend(h2("7.7 Checklist de validation"))
story.append(checklist([
    "Toutes les routes API sont wrappées par <font name='DejaVuSansMono'>withErrorHandler()</font>",
    "Aucune route ne renvoie directement le message Prisma en production",
    "Chaque réponse contient un <font name='DejaVuSansMono'>X-Correlation-Id</font>",
    "Les erreurs 500 sont loggées via <font name='DejaVuSansMono'>logger.error()</font> avec stack trace",
    "Le frontend parse les erreurs via une fonction <font name='DejaVuSansMono'>parseApiError()</font> shared",
    "Un test vérifie qu'une contrainte unique renvoie bien un 409",
    "Un test vérifie qu'une erreur Prisma inconnue renvoie un 500 sans fuite du message",
]))

story.extend(h2("7.8 Pièges à éviter"))
story.append(pitfall(
    "Logguer les erreurs 4xx au même niveau que les 5xx. Les 4xx sont "
    "des erreurs client (validation, auth) et ne méritent pas un "
    "<font name='DejaVuSansMono'>logger.error()</font>. Utiliser "
    "<font name='DejaVuSansMono'>logger.info()</font> pour les 4xx et "
    "réserver <font name='DejaVuSansMono'>error</font> aux 5xx. Sinon "
    "Sentry/ELK sera saturé de bruit inutile."
))
story.append(pitfall(
    "Renvoyer le <font name='DejaVuSansMono'>err.stack</font> dans la "
    "réponse HTTP en production. Le stack trace divulgue des informations "
    "sur la structure du code (chemins de fichiers, noms de fonctions) "
    "qui facilitent les attaques. Toujours vérifier "
    "<font name='DejaVuSansMono'>NODE_ENV === 'development'</font> avant "
    "de l'inclure."
))
story.append(pitfall(
    "Wrapper un handler qui n'utilise pas <font name='DejaVuSansMono'>Response.json()</font> "
    "ou <font name='DejaVuSansMono'>NextResponse.json()</font>. Le wrapper "
    "suppose que le handler renvoie un objet Response — sinon l'injection "
    "du header <font name='DejaVuSansMono'>X-Correlation-Id</font> plantera. "
    "Toujours typer le handler de retour comme <font name='DejaVuSansMono'>Promise&lt;Response&gt;</font>."
))

story.append(PageBreak())

# ============ CHAPITRE 8 — R-009 Stratégie de test ============
story.extend(h1("8. R-009 — Stratégie de test en trois couches"))

story.extend(h2("8.1 Objectif"))
story.append(body(
    "Mettre en place une stratégie de test couvrant les trois couches "
    "complémentaires : unitaire (fonctions pures), intégration (routes "
    "API avec base de test) et end-to-end (parcours critiques via "
    "Playwright). La cible initiale est 60 % de couverture sur "
    "<font name='DejaVuSansMono'>src/lib</font>, 40 % sur "
    "<font name='DejaVuSansMono'>src/app/api</font>, et 5 parcours E2E "
    "couvrant les chemins critiques de l'application."
))

story.extend(h2("8.2 Configuration Vitest"))
story.append(code_block('''// vitest.config.ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**", "src/app/api/**"],
      exclude: ["**/*.d.ts", "**/index.ts"],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50,
      },
    },
    setupFiles: ["./tests/setup.ts"],
    globalSetup: "./tests/global-setup.ts",
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});''', label='vitest.config.ts', language='TypeScript'))

story.extend(h2("8.3 Setup de test — base SQLite in-memory"))
story.append(body(
    "Pour les tests d'intégration, utiliser une base SQLite in-memory "
    "isolée par test. Le setup ci-dessous crée un schéma frais avant "
    "chaque test et le détruit après, garantissant qu'aucun état ne "
    "fuite entre les tests."
))
story.append(code_block('''// tests/setup.ts
import { execSync } from "child_process";
import { prisma } from "@/lib/db";

beforeEach(async () => {
  // Recrée le schéma in-memory pour chaque test
  await prisma.$executeRawUnsafe("DELETE FROM User WHERE id != '__system__';");
  // Plus simple : utiliser prisma migrate reset en début de suite
});

afterAll(async () => {
  await prisma.$disconnect();
});

// tests/global-setup.ts
import { execSync } from "child_process";

export async function setup() {
  process.env.DATABASE_URL = "file:./db/test.db";
  // Reset la DB de test
  execSync("pnpm exec prisma migrate reset --force --skip-seed", {
    stdio: "inherit",
  });
}

export async function teardown() {
  // Nettoyage final
}''', label='tests/setup.ts + tests/global-setup.ts', language='TypeScript'))

story.extend(h2("8.4 Helper — createTestUser et createTestSession"))
story.append(body(
    "Centraliser la création d'utilisateurs et de sessions de test évite "
    "la duplication de code et garantit que tous les tests utilisent des "
    "fixtures cohérentes. Le helper ci-dessous crée un utilisateur en "
    "base et génère une session JWT valide pour les tests d'intégration."
))
story.append(code_block('''// tests/helpers/test-harness.ts (partie 1/2 — createTestUser)
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

let counter = 0;

export async function createTestUser(
  opts: { email?: string; role?: string } = {},
) {
  counter++;
  const email = opts.email ?? `test-${counter}@test.local`;
  const user = await prisma.user.create({
    data: {
      email,
      name: `Test User ${counter}`,
      passwordHash: await hashPassword("TestPassword123!"),
      role: opts.role ?? "USER",
    },
  });
  return user;
}''', label='tests/helpers/test-harness.ts (1/2)', language='TypeScript'))

story.append(code_block('''// tests/helpers/test-harness.ts (partie 2/2 — createTestSession)
import { authOptions } from "@/lib/auth-config";

export async function createTestSession(
  user: { id: string; email: string },
) {
  // Génère un token JWT valide via NextAuth
  const token = await (authOptions.callbacks?.jwt as any)?.({
    token: { uid: user.id },
    user: { id: user.id, email: user.email },
    account: null,
    profile: undefined,
    isNewUser: false,
  });

  return {
    cookie: `next-auth.session-token=${token}`,
    token,
  };
}

export const API =
  process.env.TEST_API_URL ?? "http://localhost:3000";''',
    label='tests/helpers/test-harness.ts (2/2)', language='TypeScript'))

story.extend(h2("8.5 Exemple de test unitaire"))
story.append(code_block('''// tests/unit/password.test.ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hache un mot de passe et le vérifie", async () => {
    const hash = await hashPassword("S3cret!Pass");
    expect(hash).not.toBe("S3cret!Pass");
    expect(hash.startsWith("$argon2id$")).toBe(true);

    const ok = await verifyPassword(hash, "S3cret!Pass");
    expect(ok).toBe(true);

    const ko = await verifyPassword(hash, "wrong");
    expect(ko).toBe(false);
  });

  it("rejette les mots de passe trop courts", async () => {
    await expect(hashPassword("abc")).rejects.toThrow("trop court");
  });

  it("gère un hash malformé sans crasher", async () => {
    const ok = await verifyPassword("not-a-hash", "anything");
    expect(ok).toBe(false);
  });
});''', label='tests/unit/password.test.ts', language='TypeScript'))

story.extend(h2("8.6 Configuration Playwright E2E"))
story.append(code_block('''// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,   // série : la base de test est partagée
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    storageState: undefined,  // pas de session persistée
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile",   use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});''', label='playwright.config.ts', language='TypeScript'))

story.extend(h2("8.7 Parcours E2E prioritaires"))
story.append(make_table(
    header=['#', 'Parcours', 'Étapes clés', 'Assertion'],
    rows=[
        ['1', 'Login + accès dashboard', ('Login, vérif session, dashboard', 'C'), ('URL = /dashboard', 'C')],
        ['2', 'Création de lead', ('Form, submit, liste refresh', 'C'), ('Lead dans la liste', 'C')],
        ['3', 'Génération post IA', ('Topic input, générer, prévisualiser', 'C'), ('3 suggestions affichées', 'C')],
        ['4', 'Programmation LinkedIn', ('Sélection post, date future, schedule', 'C'), ('Post en file d\'attente', 'C')],
        ['5', 'Logout + protection route', ('Logout, tentative /dashboard', 'C'), ('Redirigé vers /login', 'C')],
    ],
    col_ratios=[0.05, 0.25, 0.45, 0.25]
))
story.append(Spacer(1, 14))

story.extend(h2("8.8 Checklist de validation"))
story.append(checklist([
    "<font name='DejaVuSansMono'>vitest</font> et <font name='DejaVuSansMono'>@playwright/test</font> installés",
    "<font name='DejaVuSansMono'>pnpm test</font> exécute les tests unitaires et d'intégration",
    "<font name='DejaVuSansMono'>pnpm test:e2e</font> exécute les parcours Playwright",
    "La couverture sur <font name='DejaVuSansMono'>src/lib</font> atteint 60 %",
    "La couverture sur <font name='DejaVuSansMono'>src/app/api</font> atteint 40 %",
    "Les 5 parcours E2E passent en CI",
    "L'étape CI <font name='DejaVuSansMono'>test</font> bloque les PR si la couverture baisse",
    "Un badge de couverture est affiché dans le README",
]))

story.extend(h2("8.9 Pièges à éviter"))
story.append(pitfall(
    "Partager la même base de données entre tests parallèles. Sans "
    "isolation, les tests se marchent dessus (un test supprime un lead "
    "qu'un autre test attendait). Utiliser une DB par worker Vitest via "
    "<font name='DejaVuSansMono'>DATABASE_URL=file:./db/test-${process.env.VITEST_WORKER_ID}.db</font>."
))
story.append(pitfall(
    "Mocker Prisma systématiquement dans les tests unitaires. Les mocks "
    "découplent les tests de la base, mais ils introduisent un risque : "
    "si le schéma change, le mock ne reflète pas le changement et le "
    "test passe alors que le code est cassé. Privilégier les tests "
    "d'intégration avec une vraie DB SQLite in-memory."
))
story.append(pitfall(
    "Lancer Playwright sans <font name='DejaVuSansMono'>workers: 1</font>. "
    "Plusieurs workers partagent le même serveur et la même DB — les "
    "tests E2E se marchent dessus. Soit sérialiser, soit donner une DB "
    "et un port distincts par worker."
))

story.append(PageBreak())

# ============ CHAPITRE 9 — R-010 Headers de sécurité ============
story.extend(h1("9. R-010 — Headers de sécurité HTTP"))

story.extend(h2("9.1 Objectif"))
story.append(body(
    "Compléter les en-têtes de sécurité HTTP du middleware. La version "
    "actuelle n'envoie que <font name='DejaVuSansMono'>X-Frame-Options</font>, "
    "<font name='DejaVuSansMono'>X-Content-Type-Options</font> et "
    "<font name='DejaVuSansMono'>Referrer-Policy</font>. Il manque quatre "
    "en-têtes critiques : <font name='DejaVuSansMono'>Content-Security-Policy</font> "
    "(anti-XSS), <font name='DejaVuSansMono'>Strict-Transport-Security</font> "
    "(force HTTPS), <font name='DejaVuSansMono'>Permissions-Policy</font> "
    "(limite les API navigateur) et <font name='DejaVuSansMono'>X-DNS-Prefetch-Control</font>."
))

story.extend(h2("9.2 Code actuel problématique"))
story.append(code_block('''// src/middleware.ts (extrait)
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // ← manquent : CSP, HSTS, Permissions-Policy, X-DNS-Prefetch-Control
  return res;
}''', label='src/middleware.ts', language='TypeScript'))

story.extend(h2("9.3 Helper — securityHeaders"))
story.append(code_block('''// src/lib/security-headers.ts (partie 1/2)
import { NextResponse } from "next/server";

/**
 * Politique CSP stricte mais compatible Next.js.
 * - default-src 'self' : seules les ressources du même domaine
 * - script-src : 'self' + unsafe-inline (Next.js le nécessite en dev)
 *   + nonce dynamique en production (voir 9.4)
 * - img-src : autorise LinkedIn CDN et avatars GitHub
 * - connect-src : autorise API backend + webhook LinkedIn
 */
export function buildCsp(nonce?: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = [
    "'self'",
    isDev ? "'unsafe-inline'" : nonce ? `'nonce-${nonce}'` : "'unsafe-inline'",
    "'unsafe-eval'",   // ← nécessaire pour Next.js dev tools
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: https://media.licdn.com https://avatars.githubusercontent.com",
    "connect-src 'self' https://api.linkedin.com https://*.upstash.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}''', label='src/lib/security-headers.ts (1/2)', language='TypeScript'))

story.append(code_block('''// src/lib/security-headers.ts (partie 2/2)
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security":
    "max-age=63072000; includeSubDomains; preload",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  "X-DNS-Prefetch-Control": "off",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export function applySecurityHeaders(
  res: NextResponse,
  nonce?: string,
): NextResponse {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  res.headers.set("Content-Security-Policy", buildCsp(nonce));
  return res;
}''', label='src/lib/security-headers.ts (2/2)', language='TypeScript'))

story.extend(h2("9.4 Intégration dans le middleware"))
story.append(code_block('''// src/middleware.ts (réécrit)
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { applySecurityHeaders } from "@/lib/security-headers";

export function middleware(req: NextRequest) {
  // Génère un nonce par requête pour CSP
  const nonce = randomBytes(16).toString("base64");

  const res = NextResponse.next({
    request: {
      headers: new Headers(req.headers),
    },
  });

  // Injecte le nonce dans la requête pour que Next.js l'utilise dans <script>
  res.headers.set("x-nonce", nonce);

  return applySecurityHeaders(res, nonce);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};''', label='src/middleware.ts (réécrit)', language='TypeScript'))

story.extend(h2("9.5 Test des en-têtes"))
story.append(body(
    "Valider les en-têtes via un test automatisé et via un scanner "
    "externe. Le test local vérifie la présence et la valeur de chaque "
    "en-tête. Le scanner externe (securityheaders.com, observador.mozilla.org) "
    "fournit une note objective et révèle les oublis."
))
story.append(code_block('''// tests/integration/security-headers.test.ts
import { describe, it, expect } from "vitest";

const BASE = process.env.TEST_API_URL ?? "http://localhost:3000";

describe("Headers de sécurité", () => {
  it("présents sur toutes les routes HTML", async () => {
    const res = await fetch(`${BASE}/`);
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy"))
      .toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("strict-transport-security"))
      .toContain("max-age=63072000");
    expect(res.headers.get("permissions-policy"))
      .toContain("camera=()");
    expect(res.headers.get("content-security-policy"))
      .toContain("default-src 'self'");
  });

  it("HSTS absent en HTTP dev", async () => {
    if (process.env.NODE_ENV !== "production") return;
    const res = await fetch(`${BASE}/`, { redirect: "manual" });
    expect(res.headers.get("strict-transport-security")).toBeTruthy();
  });
});''', label='tests/integration/security-headers.test.ts', language='TypeScript'))

story.extend(h2("9.6 Checklist de validation"))
story.append(checklist([
    "Le header <font name='DejaVuSansMono'>Content-Security-Policy</font> est présent sur toutes les routes HTML",
    "Le header <font name='DejaVuSansMono'>Strict-Transport-Security</font> est actif en HTTPS production",
    "Le header <font name='DejaVuSansMono'>Permissions-Policy</font> désactive camera, micro, géoloc",
    "Le scanner <font name='DejaVuSansMono'>securityheaders.com</font> donne une note A ou A+",
    "Le scanner <font name='DejaVuSansMono'>observador.mozilla.org</font> ne signale aucun warning",
    "Aucune erreur CSP dans la console navigateur sur les pages critiques",
    "Les scripts inline utilisent un nonce dynamique (pas <font name='DejaVuSansMono'>unsafe-inline</font> en prod)",
]))

story.extend(h2("9.7 Pièges à éviter"))
story.append(pitfall(
    "Activer CSP <font name='DejaVuSansMono'>default-src 'none'</font> "
    "d'un coup. Cette politique bloque tout (CSS, images, fonts) et casse "
    "immédiatement le rendu. Toujours commencer par "
    "<font name='DejaVuSansMono'>default-src 'self'</font> et assouplir "
    "au cas par cas. Utiliser le mode <font name='DejaVuSansMono'>Report-Only</font> "
    "d'abord pour collecter les violations sans bloquer."
))
story.append(pitfall(
    "Oublier d'autoriser les domaines externes réellement utilisés "
    "(LinkedIn CDN, Google Fonts, avatars GitHub). La CSP bloque "
    "silencieusement ces ressources — les images ne s'affichent pas, "
    "les fonts tombent en fallback. Auditer le HTML rendu pour lister "
    "les domaines référencés."
))
story.append(pitfall(
    "Garder <font name='DejaVuSansMono'>unsafe-inline</font> en "
    "production par commodité. Cela annule l'efficacité de la CSP contre "
    "les attaques XSS. Migrer vers un nonce dynamique ou un hash SHA "
    "par script. Next.js 16 supporte nativement les nonces via "
    "<font name='DejaVuSansMono'>headers()</font> dans le middleware."
))

story.append(PageBreak())

# ============ CHAPITRE 10 — Quick wins P2 ============
story.extend(h1("10. Quick wins P2 — Optimisations secondaires"))

story.append(body(
    "Ce chapitre regroupe cinq correctifs P2 exécutables en moins d'une "
    "demi-journée chacun. Ils ne sont pas bloquants pour la mise en "
    "production mais améliorent significativement la qualité, la "
    "performance ou la maintenabilité. Ils peuvent être traités en "
    "parallèle des chantiers P0/P1 ou en intercalaire."
))

story.extend(h2("10.1 Optimisation des images"))
story.append(body(
    "Le flag <font name='DejaVuSansMono'>images.unoptimized = true</font> "
    "désactive l'optimisation Next.js (conversion WebP/AVIF, redimensionnement, "
    "lazy-loading). Le corriger permet de réduire la taille des images "
    "transmises de 60 à 80 % selon les formats sources."
))
story.append(before_after(
'''// AVANT — next.config.ts
images: {
  unoptimized: true,
},''',
'''// APRÈS — next.config.ts
images: {
  formats: ["image/avif", "image/webp"],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  remotePatterns: [
    { protocol: "https", hostname: "media.licdn.com" },
    { protocol: "https", hostname: "avatars.githubusercontent.com" },
    { protocol: "https", hostname: "lh3.googleusercontent.com" },
  ],
  minimumCacheTTL: 60 * 60 * 24,  // 24 h
}''',
    before_label='Avant',
    after_label='Après'
))

story.extend(h2("10.2 Unifier les fichiers de déploiement"))
story.append(body(
    "Le projet contient cinq fichiers de configuration de déploiement "
    "(<font name='DejaVuSansMono'>render.yaml</font>, "
    "<font name='DejaVuSansMono'>netlify.toml</font>, "
    "<font name='DejaVuSansMono'>Caddyfile</font>, "
    "<font name='DejaVuSansMono'>docker-compose.yml</font>, "
    "<font name='DejaVuSansMono'>build.sh</font>). Cette dispersion crée "
    "de la confusion et un risque de divergence. Choisir UNE plateforme "
    "cible (recommandé : Render pour la simplicité, ou Vercel pour "
    "l'intégration native Next.js) et supprimer les autres fichiers."
))
story.append(make_table(
    header=['Fichier', 'Plateforme', 'Action', 'Risque'],
    rows=[
        ['render.yaml', 'Render', ('Conserver', 'C'), ('Aucun', 'C')],
        ['netlify.toml', 'Netlify', ('Supprimer', 'C'), ('Aucun', 'C')],
        ['Caddyfile', 'Reverse proxy', ('Supprimer', 'C'), ('Aucun si Render gère le proxy', 'C')],
        ['docker-compose.yml', 'Local / K8s', ('Conserver pour dev local', 'C'), ('Aucun', 'C')],
        ['build.sh', 'Build script', ('Migrer vers package.json', 'C'), ('Faible', 'C')],
    ],
    col_ratios=[0.22, 0.20, 0.30, 0.28]
))
story.append(Spacer(1, 14))

story.extend(h2("10.3 Logger structuré"))
story.append(body(
    "Remplacer les <font name='DejaVuSansMono'>console.log</font> et "
    "<font name='DejaVuSansMono'>console.error</font> épars dans le code "
    "par un logger structuré compatible JSON. Cela facilite l'ingestion "
    "par Datadog, ELK ou Logflare et permet le filtrage par "
    "<font name='DejaVuSansMono'>correlationId</font>, "
    "<font name='DejaVuSansMono'>userId</font>, "
    "<font name='DejaVuSansMono'>level</font>."
))
story.append(code_block('''// src/lib/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10, info: 20, warn: 30, error: 40,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

export const logger = {
  debug(msg: string, ctx?: Record<string, unknown>) { log("debug", msg, ctx); },
  info(msg: string, ctx?: Record<string, unknown>)  { log("info",  msg, ctx); },
  warn(msg: string, ctx?: Record<string, unknown>)  { log("warn",  msg, ctx); },
  error(msg: string, ctx?: Record<string, unknown>) { log("error", msg, ctx); },
};

function log(level: LogLevel, message: string, ctx?: Record<string, unknown>) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[MIN_LEVEL]) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...ctx,
  };

  const out = process.env.NODE_ENV === "production"
    ? JSON.stringify(entry)
    : `[${entry.timestamp}] ${level.toUpperCase()} ${message}\\n${
        ctx ? JSON.stringify(ctx, null, 2) : ""
      }`;

  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(out + "\\n");
}''', label='src/lib/logger.ts', language='TypeScript'))

story.extend(h2("10.4 Variables d'environnement typées"))
story.append(body(
    "Centraliser la lecture des variables d'environnement via un helper "
    "typé. Cela évite les <font name='DejaVuSansMono'>process.env.X!</font> "
    "éparpillés, garantit la validation au démarrage et facilite "
    "l'inventaire des variables requises."
))
story.append(code_block('''// src/lib/env.ts
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  UPSTASH_REDIS_URL: z.string().url(),
  UPSTASH_REDIS_TOKEN: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  LINKEDIN_CLIENT_ID: z.string().min(1).optional(),
  LINKEDIN_CLIENT_SECRET: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables d'environnement invalides:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;''', label='src/lib/env.ts', language='TypeScript'))

story.extend(h2("10.5 Lint rules personnalisés"))
story.append(body(
    "Ajouter un lint rule personnalisé qui bloque l'introduction de "
    "<font name='DejaVuSansMono'>any</font> et de "
    "<font name='DejaVuSansMono'>console.log</font>. Ce garde-fou empêche "
    "la réintroduction de la dette technique corrigée au chapitre 4."
))
story.append(code_block('''// .eslintrc.additional.js
module.exports = {
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "no-console": ["error", { allow: ["warn", "error"] }],
    "@typescript-eslint/consistent-type-imports": "warn",
    "prefer-const": "error",
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      files: ["scripts/**", "prisma/**"],
      rules: { "no-console": "off" },
    },
  ],
};''', label='.eslintrc.additional.js', language='JavaScript'))

story.extend(h2("10.6 Checklist globale P2"))
story.append(checklist([
    "<font name='DejaVuSansMono'>images.unoptimized</font> est supprimé de next.config.ts",
    "Le nombre de fichiers de déploiement est réduit à 2 maximum",
    "Le logger structuré remplace les <font name='DejaVuSansMono'>console.log</font>",
    "Le fichier <font name='DejaVuSansMono'>src/lib/env.ts</font> valide toutes les variables au boot",
    "Les lint rules custom sont actifs et bloquent les nouveaux <font name='DejaVuSansMono'>any</font>",
    "Les images servies sont en WebP/AVIF (vérifier l'en-tête <font name='DejaVuSansMono'>Content-Type</font>)",
]))

story.append(PageBreak())

# ============ CHAPITRE 11 — Conclusion et prochaines étapes ============
story.extend(h1("11. Conclusion et prochaines étapes"))

story.append(body(
    "Ce Volume 2 a transformé les dix-neuf recommandations stratégiques "
    "du Volume 1 en un ensemble de livrables techniques directement "
    "actionnables. Chacun des huit chapitres P0/P1 fournit le code "
    "corrigé, les helpers réutilisables, les checklists de validation "
    "et la liste des pièges connus. Le développeur en charge d'un "
    "risque peut désormais livrer la correction sans avoir à reconcevoir "
    "la solution, et sans risque de réintroduire un défaut déjà identifié."
))

story.append(body(
    "Les dix helpers livrés — <font name='DejaVuSansMono'>hashPassword</font>, "
    "<font name='DejaVuSansMono'>requireSession</font>, "
    "<font name='DejaVuSansMono'>requireUser</font>, "
    "<font name='DejaVuSansMono'>assertOwnership</font>, "
    "<font name='DejaVuSansMono'>narrowUnknown</font>, "
    "<font name='DejaVuSansMono'>prismaLog</font>, "
    "<font name='DejaVuSansMono'>rateLimiters</font>, "
    "<font name='DejaVuSansMono'>ApiError</font>, "
    "<font name='DejaVuSansMono'>withErrorHandler</font> et "
    "<font name='DejaVuSansMono'>securityHeaders</font> — constituent une "
    "boîte à outils cohérente qui doit être déposée dans "
    "<font name='DejaVuSansMono'>src/lib/</font> avant le démarrage des "
    "chantiers. Ils forment le socle technique transverse du projet et "
    "faciliteront tout refactor futur."
))

story.append(callout(
    "Recommandation finale",
    "Traitement dans l'ordre : P0 (chapitres 2 à 4) en semaines 1 à 2, "
    "P1 (chapitres 5 à 9) en semaines 3 à 8, quick wins P2 (chapitre 10) "
    "en intercalaire dès qu'une fenêtre de une demi-journée se présente. "
    "Ne pas paralléliser P0 et P1 — les P1 dépendent structurellement "
    "des P0 (par exemple <font name='DejaVuSansMono'>requireUser()</font> "
    "suppose que <font name='DejaVuSansMono'>requireSession()</font> existe). "
    "Une fois les P0 livrés et stabilisés en staging, entamer les P1.",
    color=ACCENT
))

story.extend(h2("11.1 Prochaines étapes recommandées"))
story.append(bullet(
    "<b>Semaine 1</b> — Déposer les 10 helpers dans <font name='DejaVuSansMono'>src/lib/</font> "
    "via une PR dédiée, sans modifier les routes existantes. Cela permet "
    "de valider la compilation et le typage avant tout chantier."
))
story.append(bullet(
    "<b>Semaines 2 à 3</b> — Traiter R-001 (auth) et R-002 (multi-tenant) "
    "ensemble, car ils sont structurellement liés. Une PR unique par "
    "couple (helper + routes migrées) facilite la review."
))
story.append(bullet(
    "<b>Semaines 4 à 5</b> — Traiter R-003 (build strict) et R-004/005 "
    "(base de données). Ces deux chantiers ne touchent pas les mêmes "
    "fichiers et peuvent être parallélisés si deux développeurs sont "
    "disponibles."
))
story.append(bullet(
    "<b>Semaines 6 à 8</b> — Traiter R-007 (rate-limit), R-008 (erreurs "
    "API) et R-010 (headers sécurité). Ces trois sujets sont indépendants "
    "et peuvent être menés en parallèle."
))
story.append(bullet(
    "<b>Semaines 9 à 11</b> — Construire la stratégie de test (R-009). "
    "Attendre que les P0/P1 soient livrés pour éviter d'écrire des tests "
    "sur du code en cours de refactoring."
))
story.append(bullet(
    "<b>Semaine 12</b> — Quick wins P2 (chapitre 10) et préparation du "
    "Volume 3 dédié aux optimisations de second ordre (P2 restants)."
))

story.extend(h2("11.2 Métriques de succès"))

story.append(make_table(
    header=['Métrique', 'Valeur initiale', 'Cible S2', 'Cible S8', 'Cible S12'],
    rows=[
        ['Nombre de any', ('87', 'C'), ('60', 'C'), ('20', 'C'), ('5', 'C')],
        ['Couverture src/lib', ('0%', 'C'), ('30%', 'C'), ('60%', 'C'), ('70%', 'C')],
        ['Couverture src/app/api', ('0%', 'C'), ('10%', 'C'), ('40%', 'C'), ('50%', 'C')],
        ['Routes API wrappées withErrorHandler', ('0%', 'C'), ('50%', 'C'), ('100%', 'C'), ('100%', 'C')],
        ['Routes multi-tenant (requireUser)', ('0%', 'C'), ('50%', 'C'), ('100%', 'C'), ('100%', 'C')],
        ['Note securityheaders.com', ('F', 'C'), ('B', 'C'), ('A', 'C'), ('A+', 'C')],
        ['Erreurs 500 / semaine (Sentry)', ('N/A', 'C'), ('<50', 'C'), ('<10', 'C'), ('<5', 'C')],
    ],
    col_ratios=[0.35, 0.16, 0.16, 0.16, 0.17]
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "<i>Tableau — Métriques mesurables pour valider la progression de la roadmap.</i>",
    sMeta
))
story.append(Spacer(1, 14))

story.extend(h2("11.3 Liens avec le Volume 3"))
story.append(body(
    "Le Volume 3, à publier après livraison du présent volume, traitera "
    "les neuf risques P2 restants : nettoyage des "
    "<font name='DejaVuSansMono'>any</font> résiduels, configuration "
    " fine des images par route, suppression des caches in-memory "
    "résiduels, audit de l'orchestrateur de workflows, optimisation du "
    "bundle client, accessibility (a11y), internationalisation (i18n), "
    "documentation API OpenAPI et stratégie de migration progressive "
    "vers PostgreSQL. Il inclura également le retour d'expérience "
    "post-implémentation du Volume 2 et les ajustements éventuels."
))

# ===PLACEHOLDER_FINAL===

# ============ Build ============
def build():
    doc = TocDocTemplate(
        OUTPUT_BODY,
        pagesize=A4,
        leftMargin=LEFT_MARGIN, rightMargin=RIGHT_MARGIN,
        topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
        title="HERMÈS — Volume 2 — Guide d'Implémentation Technique",
        author="HERMÈS Audit Technique",
        subject="Recommandations d'implémentation P0/P1/P2",
        creator="ReportLab + Playwright",
    )
    doc.multiBuild(story, onFirstPage=_draw_page_chrome, onLaterPages=_draw_page_chrome)
    print(f"✓ Body PDF généré: {OUTPUT_BODY}")

    # Merge cover + body
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        from PyPDF2 import PdfReader, PdfWriter

    writer = PdfWriter()

    # Cover — normalize page size to exact A4 by merging onto a fresh A4 page
    if os.path.exists(COVER_PDF):
        try:
            from pypdf import PageObject, Transformation
        except ImportError:
            from PyPDF2 import PageObject, Transformation
        cover = PdfReader(COVER_PDF)
        for src_page in cover.pages:
            new_page = PageObject.create_blank_page(width=PAGE_W, height=PAGE_H)
            src_w = float(src_page.mediabox.width)
            src_h = float(src_page.mediabox.height)
            scale = min(PAGE_W / src_w, PAGE_H / src_h)
            new_page.merge_transformed_page(
                src_page,
                Transformation().scale(scale, scale),
            )
            writer.add_page(new_page)
        print(f"✓ Cover ajouté: {len(cover.pages)} page(s) (normalisé A4)")
    else:
        print(f"⚠ Cover non trouvé: {COVER_PDF}")

    # Body
    body_pdf = PdfReader(OUTPUT_BODY)
    for page in body_pdf.pages:
        writer.add_page(page)
    print(f"✓ Body ajouté: {len(body_pdf.pages)} page(s)")

    # Métadonnées
    writer.add_metadata({
        "/Title": "HERMÈS — Volume 2 — Guide d'Implémentation Technique",
        "/Author": "HERMÈS Audit Technique",
        "/Subject": "Recommandations d'implémentation P0/P1/P2",
        "/Creator": "ReportLab + Playwright",
        "/Producer": "HERMÈS Audit Pipeline",
    })

    os.makedirs(os.path.dirname(OUTPUT_FINAL), exist_ok=True)
    with open(OUTPUT_FINAL, "wb") as f:
        writer.write(f)

    total = len(writer.pages)
    size_kb = os.path.getsize(OUTPUT_FINAL) / 1024
    print(f"\n✓ PDF final: {OUTPUT_FINAL}")
    print(f"  Pages: {total}")
    print(f"  Taille: {size_kb:.1f} KB")


if __name__ == "__main__":
    build()







