#!/usr/bin/env python3
"""
HERMÈS — Audit Technique 2026
Rapport de Recommandations Stratégiques

Body PDF (ReportLab) + Cover (HTML/Playwright already rendered separately).
Final merge via pypdf.
"""
import os
import sys
import hashlib
import platform

# ─── Skill scripts path for install_font_fallback ───
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
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ─── Font registration ───
FONT_DIR = '/usr/share/fonts'

# Use Noto Serif SC static weights (variable font NotoSansSC[wght].ttf not supported by ReportLab)
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                   italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ─── Cascade Palette ───
PAGE_BG       = colors.HexColor('#f4f6f5')
SECTION_BG    = colors.HexColor('#e8eae9')
CARD_BG       = colors.HexColor('#ebf0ee')
TABLE_STRIPE  = colors.HexColor('#ebefed')
HEADER_FILL   = colors.HexColor('#486757')
COVER_BLOCK   = colors.HexColor('#4b6658')
BORDER        = colors.HexColor('#aec0b7')
ICON          = colors.HexColor('#487c62')
ACCENT        = colors.HexColor('#1c9659')
ACCENT_2      = colors.HexColor('#51cdcd')
TEXT_PRIMARY  = colors.HexColor('#181b1a')
TEXT_MUTED    = colors.HexColor('#79847f')
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

OUTPUT_BODY = '/home/z/my-project/scripts/audit_body.pdf'
OUTPUT_FINAL = '/home/z/my-project/download/HERMES_Audit_Recommandations_2026.pdf'
COVER_PDF = '/home/z/my-project/scripts/audit_cover.pdf'

# ─── Styles ───
BODY_FONT = 'FreeSerif'
BODY_FONT_BOLD = 'FreeSerif-Bold'

sH1 = ParagraphStyle('sH1', fontName=BODY_FONT_BOLD, fontSize=18, leading=24,
                     textColor=HEADER_FILL, spaceBefore=18, spaceAfter=10, alignment=TA_LEFT)
sH2 = ParagraphStyle('sH2', fontName=BODY_FONT_BOLD, fontSize=13.5, leading=18,
                     textColor=ACCENT, spaceBefore=14, spaceAfter=6, alignment=TA_LEFT)
sH3 = ParagraphStyle('sH3', fontName=BODY_FONT_BOLD, fontSize=11.5, leading=16,
                     textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=4, alignment=TA_LEFT)
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
    """Small stat callout."""
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
    n_cols = len(header)
    if col_ratios is None:
        col_ratios = [1.0 / n_cols] * n_cols
    col_widths = [r * CONTENT_W for r in col_ratios]
    if header_align is None:
        header_align = [TA_CENTER] * n_cols

    # Header row
    header_styles = [
        ParagraphStyle(f'hh{i}', fontName=BODY_FONT_BOLD, fontSize=9.5, leading=13,
                       textColor=colors.white, alignment=header_align[i])
        for i in range(n_cols)
    ]
    header_row = [Paragraph(f'<b>{header[i]}</b>', header_styles[i]) for i in range(n_cols)]

    # Body rows
    body_row_style = ParagraphStyle('tbr', fontName=BODY_FONT, fontSize=9, leading=12.5,
                                    textColor=TEXT_PRIMARY, alignment=TA_LEFT)
    body_row_center = ParagraphStyle('tbrc', fontName=BODY_FONT, fontSize=9, leading=12.5,
                                     textColor=TEXT_PRIMARY, alignment=TA_CENTER)
    data = [header_row]
    for r in rows:
        row = []
        for i, cell in enumerate(r):
            # If cell is a tuple (text, align), use that
            if isinstance(cell, tuple):
                text, align = cell
                style = body_row_center if align == 'C' else body_row_style
            elif i == 0:
                style = body_row_style
            else:
                style = body_row_style
            row.append(Paragraph(str(cell) if not isinstance(cell, tuple) else text, style))
        data.append(row)

    table = Table(data, colWidths=col_widths, hAlign='CENTER', repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]
    # Alternating row colors
    for i in range(1, len(data)):
        if i % 2 == 1:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_ROW_EVEN))
        else:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_ROW_ODD))
    table.setStyle(TableStyle(style_cmds))
    return table

# ─── TOC Document Template ───
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ─── Header / Footer ───
def header_footer(canvas, doc):
    canvas.saveState()
    # Header
    canvas.setFont(BODY_FONT, 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(LEFT_MARGIN, PAGE_H - 14 * mm,
                      "HERMÈS — Audit Technique 2026")
    canvas.drawRightString(PAGE_W - RIGHT_MARGIN, PAGE_H - 14 * mm,
                           "Rapport de Recommandations")
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.4)
    canvas.line(LEFT_MARGIN, PAGE_H - 16 * mm,
                PAGE_W - RIGHT_MARGIN, PAGE_H - 16 * mm)
    # Footer
    canvas.setFont(BODY_FONT, 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(LEFT_MARGIN, 12 * mm, "Audit Interne · Confidentiel")
    page_num = canvas.getPageNumber()
    canvas.drawRightString(PAGE_W - RIGHT_MARGIN, 12 * mm, f"Page {page_num}")
    canvas.line(LEFT_MARGIN, 14 * mm, PAGE_W - RIGHT_MARGIN, 14 * mm)
    canvas.restoreState()

# ─── Build Story ───
story = []

# ============ TOC ============
story.append(Paragraph('<b>Table des matières</b>', sTOCTitle))
story.append(HRFlowable(width="100%", thickness=1.5, color=HEADER_FILL,
                        spaceBefore=0, spaceAfter=14))
toc = TableOfContents()
toc.levelStyles = [sTOCLvl0, sTOCLvl1]
story.append(toc)
story.append(PageBreak())

# ============ CHAPITRE 1 — Synthèse Exécutive ============
story.extend(h1("1. Synthèse exécutive"))

story.extend(h2("1.1 Contexte et objectifs de l'audit"))
story.append(body(
    "HERMÈS est une plateforme B2B d'automatisation LinkedIn construite sur "
    "Next.js 16, React 19, Prisma 6 et TypeScript 5. L'application orchestre "
    "la génération de contenu par IA, la publication programmée, la gestion "
    "de leads, les séquences email, les workflows métier, les webhooks, "
    "l'A/B testing et le suivi de conformité LinkedIn. Le codebase compte "
    "plus de trente routes API, une dizaine de moteurs métier et un schéma "
    "Prisma de près de 750 lignes."
))
story.append(body(
    "Cet audit a été conduit dans une optique d'industrialisation : préparer "
    "la plateforme à une mise en production multi-tenant, à une certification "
    "RGPD et à une présentation à des investisseurs ou clients entreprise. "
    "L'objectif n'est pas de lister exhaustivement les défauts cosmétiques, "
    "mais d'identifier les risques bloquants — sécuritaires, architecturaux "
    "ou de dette technique — qui empêcheraient HERMÈS de passer à l'échelle "
    "supérieure. Chaque recommandation est priorisée, chiffrée en effort et "
    "associée à un impact métier mesurable."
))

story.extend(h2("1.2 Méthodologie"))
story.append(body(
    "L'audit s'est appuyé sur cinq axes complémentaires. Premièrement, "
    "l'analyse statique du code source — lecture croisée du middleware, "
    "des configurations Next.js et Prisma, des routes API et des moteurs "
    "lib — a permis d'identifier les anti-patterns structurels. Deuxièmement, "
    "l'inspection du schéma de données Prisma a révélé des incohérences "
    "entre la configuration déclarée (PostgreSQL) et la configuration "
    "effective (SQLite). Troisièmement, la cartographie des dépendances et "
    "de la chaîne de build a mis en évidence des dérives de configuration. "
    "Quatrièmement, l'examen des mécanismes d'authentification, "
    "d'autorisation et de session a révélé des vulnérabilités critiques. "
    "Cinquièmement, l'évaluation de la stratégie de test a montré une "
    "absence totale de couverture automatisée."
))

story.extend(h2("1.3 Synthèse des constats par criticité"))
story.append(body(
    "L'audit a identifié dix-neuf risques significatifs répartis en trois "
    "niveaux de priorité. Trois risques P0 — bloquants pour toute mise en "
    "production — concernent l'authentification, le modèle multi-tenant et "
    "la chaîne de build. Sept risques P1 doivent être traités dans les "
    "quatre à huit semaines pour atteindre un niveau de maturité acceptable. "
    "Neuf risques P2 relèvent de l'amélioration continue et peuvent être "
    "absorbés par l'équipe produit sur le trimestre."
))

# Stat row
stat_table = Table([[
    stat_box('3', 'Risques P0', SEM_ERROR),
    stat_box('7', 'Risques P1', SEM_WARNING),
    stat_box('9', 'Risques P2', SEM_INFO),
    stat_box('19', 'Risques totaux', ACCENT),
]], colWidths=[CONTENT_W/4]*4)
stat_table.setStyle(TableStyle([
    ('LEFTPADDING', (0,0), (-1,-1), 4),
    ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
]))
story.append(Spacer(1, 6))
story.append(stat_table)
story.append(Spacer(1, 14))

story.append(callout(
    "Verdict global",
    "La plateforme HERMÈS démontre une excellente couverture fonctionnelle et "
    "une architecture modulaire solide. Cependant, dans son état actuel, elle "
    "n'est pas conforme aux exigences d'une mise en production multi-tenant : "
    "l'authentification repose sur un compte démo hardcodé, toutes les données "
    "sont partagées via un DEFAULT_USER_ID unique, et le build ignore "
    "silencieusement les erreurs TypeScript. Les corrections P0 représentent "
    "environ deux semaines de travail et débloquent la totalité de la roadmap "
    "d'industrialisation.",
    color=SEM_WARNING
))

story.append(PageBreak())

# ============ CHAPITRE 2 — Cartographie des risques ============
story.extend(h1("2. Cartographie des risques"))

story.extend(h2("2.1 Vue d'ensemble par couche"))
story.append(body(
    "Les risques identifiés ont été classés selon cinq couches techniques "
    "distinctes. Cette segmentation permet d'orienter les actions correctives "
    "vers les équipes ou contributeurs concernés, et de visualiser les "
    "concentrations de dette technique. La couche sécurité concentre la "
    "majorité des risques critiques, suivie par la couche données qui souffre "
    "d'une incohérence de configuration entre développement et production."
))

story.append(Spacer(1, 8))
story.append(make_table(
    header=['Couche', 'P0', 'P1', 'P2', 'Total', 'Maturité'],
    rows=[
        ['Sécurité & Auth', ('3', 'C'), ('2', 'C'), ('1', 'C'), ('6', 'C'), ('Faible', 'C')],
        ['Données & Persistance', ('0', 'C'), ('2', 'C'), ('1', 'C'), ('3', 'C'), ('Moyenne', 'C')],
        ['Build & TypeScript', ('1', 'C'), ('1', 'C'), ('0', 'C'), ('2', 'C'), ('Faible', 'C')],
        ['API & Résilience', ('0', 'C'), ('1', 'C'), ('3', 'C'), ('4', 'C'), ('Moyenne', 'C')],
        ['Observabilité & Tests', ('0', 'C'), ('1', 'C'), ('4', 'C'), ('5', 'C'), ('Très faible', 'C')],
    ],
    col_ratios=[0.32, 0.10, 0.10, 0.10, 0.13, 0.25]
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "<i>Tableau 1 — Distribution des risques par couche technique et niveau de priorité.</i>",
    sMeta
))
story.append(Spacer(1, 14))

story.extend(h2("2.2 Matrice criticité × probabilité"))
story.append(body(
    "La matrice ci-dessous croise l'impact métier (sécurité, conformité, "
    "continuité de service, réputation) avec la probabilité d'occurrence "
    "observée. Les risques P0 se situent tous dans le quadrant "
    "« impact critique × probabilité élevée » — ils ne sont pas hypothétiques "
    "mais constituent des vulnérabilités actives qui seraient exploitées "
    "dès la première mise en ligne non protégée."
))

story.append(Spacer(1, 6))
story.append(make_table(
    header=['ID', 'Risque', 'Impact', 'Probabilité', 'Niveau'],
    rows=[
        ['R-001', 'Authentification démo hardcodée', ('Critique', 'C'), ('Élevée', 'C'), ('P0', 'C')],
        ['R-002', 'Pas de multi-tenant (DEFAULT_USER_ID)', ('Critique', 'C'), ('Élevée', 'C'), ('P0', 'C')],
        ['R-003', 'ignoreBuildErrors masque les erreurs TS', ('Critique', 'C'), ('Élevée', 'C'), ('P0', 'C')],
        ['R-004', 'Schéma PostgreSQL / SQLite incohérent', ('Élevé', 'C'), ('Élevée', 'C'), ('P1', 'C')],
        ['R-005', 'Prisma log:query actif en production', ('Élevé', 'C'), ('Élevée', 'C'), ('P1', 'C')],
        ['R-006', 'Aucune migration versionnée', ('Élevé', 'C'), ('Moyenne', 'C'), ('P1', 'C')],
        ['R-007', 'Rate-limit in-memory (multi-instance)', ('Élevé', 'C'), ('Élevée', 'C'), ('P1', 'C')],
        ['R-008', 'Routes API sans try/catch', ('Moyen', 'C'), ('Élevée', 'C'), ('P1', 'C')],
        ['R-009', 'Absence de tests automatisés', ('Élevé', 'C'), ('Certaine', 'C'), ('P1', 'C')],
        ['R-010', 'Headers de sécurité incomplets (CSP, HSTS)', ('Moyen', 'C'), ('Élevée', 'C'), ('P1', 'C')],
        ['R-011', '87 types any sur 30 fichiers', ('Moyen', 'C'), ('Certaine', 'C'), ('P2', 'C')],
        ['R-012', 'images.unoptimized = true', ('Faible', 'C'), ('Certaine', 'C'), ('P2', 'C')],
        ['R-013', 'ensureDefaultUser sur chaque écriture', ('Faible', 'C'), ('Certaine', 'C'), ('P2', 'C')],
        ['R-014', 'Configuration de déploiement multiple', ('Faible', 'C'), ('Moyenne', 'C'), ('P2', 'C')],
    ],
    col_ratios=[0.10, 0.42, 0.16, 0.16, 0.16]
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "<i>Tableau 2 — Matrice des risques principaux avec impact, probabilité et niveau de priorité.</i>",
    sMeta
))
story.append(Spacer(1, 14))

story.extend(h2("2.3 Score global de maturité"))
story.append(body(
    "Sur une échelle de maturité à cinq niveaux — Initial, Reproductible, "
    "Défini, Maîtrisé, Optimisé — HERMÈS se positionne globalement au niveau "
    "« Reproductible » (niveau 2 sur 5). La couverture fonctionnelle et la "
    "structuration du code sont de qualité correcte, mais les pratiques de "
    "sécurité, de test et d'observabilité restent au niveau Initial. "
    "L'objectif post-audit est d'atteindre le niveau « Défini » sur toutes "
    "les couches sous trois mois, puis « Maîtrisé » sous six mois."
))

story.append(PageBreak())

# ============ CHAPITRE 3 — Recommandations P0 ============
story.extend(h1("3. Recommandations P0 — Critiques"))

story.append(callout(
    "Engagement de délai",
    "Les trois recommandations P0 doivent être traitées en moins de deux "
    "semaines ouvrées. Aucune mise en production, aucune démo client et "
    "aucun partage de preview public ne doivent avoir lieu avant leur "
    "résolution complète. Ces correctifs sont des prérequis à toute "
    "communication externe.",
    color=SEM_ERROR
))

story.extend(h2("3.1 R-001 — Réécrire l'authentification"))

story.extend(h3("Constat"))
story.append(body(
    "Le fichier <font name='DejaVuSans'>src/lib/auth-config.ts</font> "
    "implémente un unique compte démo hardcodé : "
    "<font name='DejaVuSans'>demo@hermes.app</font> avec le mot de passe "
    "<font name='DejaVuSans'>hermes2024</font>. La comparaison se fait en "
    "clair, sans hachage, sans salage, sans verrouillage anti-brute-force. "
    "Le secret JWT utilisé a une valeur de repli hardcodée — "
    "<font name='DejaVuSans'>\"hermes-dev-secret-change-in-production\"</font> — "
    "qui sera utilisée si NEXTAUTH_SECRET n'est pas défini en environnement, "
    "ce qui rend les tokens forgeables. Enfin, le middleware désactive "
    "complètement l'authentification en développement, créant un faux "
    "sentiment de sécurité lors des tests locaux."
))

story.extend(h3("Recommandation"))
story.append(body(
    "Migrer vers un fournisseur OAuth réel (GitHub, Google) ou implémenter "
    "un provider Credentials avec stockage en base de données, mots de passe "
    "hachés via <font name='DejaVuSans'>argon2id</font> (préférable à bcrypt "
    "pour la résistance GPU), et vérification systématique en base. Ajouter "
    "un rate-limit dédié sur la route "
    "<font name='DejaVuSans'>/api/auth/callback/credentials</font> "
    "(5 tentatives / 15 minutes / IP). Supprimer le fallback de "
    "NEXTAUTH_SECRET : lancer une exception au démarrage si la variable "
    "n'est pas définie. Conserver l'authentification active en développement "
    "pour éviter les divergements de comportement entre environnements."
))

story.extend(h3("Effort et impact"))
story.append(make_table(
    header=['Dimension', 'Valeur'],
    rows=[
        ['Effort estimé', ('3 jours-homme', 'C')],
        ['Complexité', ('Moyenne', 'C')],
        ['Dépendances', ('Aucune', 'C')],
        ['Impact sécurité', ('Critique', 'C')],
        ['Impact conformité RGPD', ('Élevé', 'C')],
    ],
    col_ratios=[0.45, 0.55]
))
story.append(Spacer(1, 14))

story.extend(h2("3.2 R-002 — Imposer le multi-tenant"))

story.extend(h3("Constat"))
story.append(body(
    "Le fichier <font name='DejaVuSans'>src/lib/db.ts</font> exporte une "
    "constante <font name='DejaVuSans'>DEFAULT_USER_ID = \"default\"</font> "
    "utilisée par la quasi-totalité des routes API. Cela signifie que tous "
    "les leads, posts, métriques, contacts, deals, emails, workflows et "
    "notifications sont stockés sans isolation entre utilisateurs. Même si "
    "l'authentification était corrigée, n'importe quel utilisateur "
    "authentifié pourrait consulter et modifier les données de tous les "
    "autres utilisateurs. C'est un défaut architectural bloquant pour toute "
    "utilisation réelle en SaaS."
))

story.extend(h3("Recommandation"))
story.append(body(
    "Remplacer toutes les références à <font name='DejaVuSans'>DEFAULT_USER_ID</font> "
    "par <font name='DejaVuSans'>session.user.id</font> obtenu via "
    "<font name='DejaVuSans'>getServerSession()</font>. Ajouter un garde-fou "
    "centralisé — une fonction <font name='DejaVuSans'>requireUser()</font> "
    "qui lève une erreur 401 si la session est absente et renvoie "
    "l'identifiant utilisateur. Effectuer un audit systématique de chaque "
    "requête Prisma pour vérifier la présence d'un filtre "
    "<font name='DejaVuSans'>where: { userId }</font>. Compléter par des "
    "tests d'intrusion : un utilisateur A ne doit jamais pouvoir lire ou "
    "modifier une ressource appartenant à un utilisateur B."
))

story.extend(h3("Effort et impact"))
story.append(make_table(
    header=['Dimension', 'Valeur'],
    rows=[
        ['Effort estimé', ('5 jours-homme', 'C')],
        ['Complexité', ('Élevée', 'C')],
        ['Dépendances', ('R-001 (auth)', 'C')],
        ['Impact sécurité', ('Critique', 'C')],
        ['Impact business model', ('Critique — sans SaaS possible', 'C')],
    ],
    col_ratios=[0.45, 0.55]
))
story.append(Spacer(1, 14))

story.extend(h2("3.3 R-003 — Désactiver ignoreBuildErrors"))

story.extend(h3("Constat"))
story.append(body(
    "Le fichier <font name='DejaVuSans'>next.config.ts</font> contient la "
    "ligne <font name='DejaVuSans'>typescript: { ignoreBuildErrors: true }</font>. "
    "Cette configuration indique à Next.js de produire un bundle de "
    "production même si le compilateur TypeScript détecte des erreurs de "
    "types. En conséquence, des bugs silencieux — variables mal typées, "
    "propriétés inexistantes, nullabilités ignorées — peuvent passer en "
    "production sans qu'aucun signal d'alarme ne soit émis. L'audit a "
    "également relevé 87 occurrences de type <font name='DejaVuSans'>any</font> "
    "réparties sur 30 fichiers, ce qui suggère que le typage a été relâché "
    "pour faire taire le compilateur plutôt que pour refléter une intention."
))

story.extend(h3("Recommandation"))
story.append(body(
    "Supprimer immédiatement la ligne <font name='DejaVuSans'>ignoreBuildErrors</font>. "
    "Lancer <font name='DejaVuSans'>npx tsc --noEmit</font> pour obtenir la "
    "liste exhaustive des erreurs. Les corriger par ordre de criticité : "
    "d'abord les erreurs dans les routes API et les moteurs lib (impact "
    "runtime), ensuite les erreurs dans les composants UI (impact visuel). "
    "Pour les <font name='DejaVuSans'>any</font> légitimes (rare), utiliser "
    "<font name='DejaVuSans'>unknown</font> avec un narrowing explicite ou "
    "créer un type dédié. Ajouter <font name='DejaVuSans'>tsc --noEmit</font> "
    "comme étape obligatoire dans la pipeline CI."
))

story.extend(h3("Effort et impact"))
story.append(make_table(
    header=['Dimension', 'Valeur'],
    rows=[
        ['Effort estimé', ('4 jours-homme', 'C')],
        ['Complexité', ('Faible', 'C')],
        ['Dépendances', ('Aucune', 'C')],
        ['Impact qualité', ('Élevé', 'C')],
        ['Impact maintenance', ('Élevé — diminue la dette future', 'C')],
    ],
    col_ratios=[0.45, 0.55]
))

story.append(PageBreak())

# ============ CHAPITRE 4 — Recommandations P1 ============
story.extend(h1("4. Recommandations P1 — Hautes"))

story.append(body(
    "Les recommandations P1 ne sont pas bloquantes pour une mise en ligne "
    "interne ou une démo encadrée, mais doivent être traitées avant toute "
    "communication publique, présentation client ou montage en charge. "
    "Elles concernent la cohérence de la base de données, la résilience "
    "applicative, la sécurité des en-têtes HTTP et la stratégie de test."
))

story.extend(h2("4.1 R-004 & R-005 — Base de données : aligner schéma et logs"))

story.extend(h3("Constat"))
story.append(body(
    "Le schéma Prisma déclare <font name='DejaVuSans'>provider = \"postgresql\"</font> "
    "mais le fichier <font name='DejaVuSans'>.env</font> utilise "
    "<font name='DejaVuSans'>DATABASE_URL=file:...sqlite</font>. Cette "
    "incohérence signifie que certaines fonctionnalités Prisma (types "
    "spécifiques PostgreSQL, migrations avancées, JSON indexé) pourraient "
    "échouer en production. Par ailleurs, le client Prisma est instancié "
    "avec <font name='DejaVuSans'>log: ['query']</font>, ce qui produit "
    "une ligne de log par requête SQL — potentiellement des milliers par "
    "minute en production. Cette verbosité saturera les agrégateurs de logs "
    "(Datadog, ELK), masquera les vraies erreurs et augmentera "
    "significativement les coûts d'observabilité."
))

story.extend(h3("Recommandation"))
story.append(body(
    "Aligner le schéma et la configuration runtime : soit conserver SQLite "
    "en modifiant le provider du schéma à <font name='DejaVuSans'>sqlite</font>, "
    "soit migrer réellement vers PostgreSQL (recommandé pour la production). "
    "Dans les deux cas, versionner les migrations via "
    "<font name='DejaVuSans'>prisma migrate dev</font> plutôt que "
    "<font name='DejaVuSans'>prisma db push</font>. Concernant les logs, "
    "passer à <font name='DejaVuSans'>log: process.env.NODE_ENV === 'development' "
    "? ['query', 'error', 'warn'] : ['error', 'warn']</font>. Enfin, "
    "remplacer la fonction <font name='DejaVuSans'>ensureDefaultUser()</font> "
    "appelée à chaque écriture par un seed unique exécuté au déploiement."
))

story.append(Spacer(1, 8))
story.append(make_table(
    header=['Sous-tâche', 'Effort', 'Priorité'],
    rows=[
        ['Aligner provider Prisma ↔ DATABASE_URL', ('2 heures', 'C'), ('P1', 'C')],
        ['Activer prisma migrate (première migration)', ('4 heures', 'C'), ('P1', 'C')],
        ['Désactiver log:query en production', ('30 minutes', 'C'), ('P1', 'C')],
        ['Supprimer ensureDefaultUser des routes write', ('1 jour', 'C'), ('P2', 'C')],
    ],
    col_ratios=[0.55, 0.20, 0.25]
))
story.append(Spacer(1, 14))

story.extend(h2("4.2 R-007 — Rate-limit distribué"))

story.extend(h3("Constat"))
story.append(body(
    "Le middleware utilise un <font name='DejaVuSans'>Map<string, ...></font> "
    "en mémoire pour suivre le comptage de requêtes par adresse IP. Cette "
    "approche fonctionne sur une instance unique mais devient inopérante "
    "dès que l'application est déployée sur plusieurs instances (Render, "
    "Netlify Functions, conteneurs Kubernetes). Chaque instance ayant sa "
    "propre Map, un attaquant peut envoyer N × 60 requêtes par minute en "
    "répartissant sa charge sur plusieurs instances via le load balancer. "
    "Le seuil de 60 requêtes par minute est par ailleurs trop généreux "
    "pour les routes d'authentification et trop strict pour les routes de "
    "lecture de données agrégées."
))

story.extend(h3("Recommandation"))
story.append(body(
    "Migrer vers un store distribué — Upstash Redis (serverless, gratuit "
    "jusqu'à 10 000 commandes par jour) ou un Redis managé. Utiliser la "
    "bibliothèque <font name='DejaVuSans'>@upstash/ratelimit</font> qui "
    "implémente l'algorithme sliding-window. Définir des limites par "
    "catégorie de route : auth (5 req/min), écriture (30 req/min), lecture "
    "(120 req/min), AI (10 req/min pour limiter les coûts). Ajouter une "
    "header <font name='DejaVuSans'>X-RateLimit-Remaining</font> pour "
    "permettre aux clients d'adapter leur cadence."
))

story.append(Spacer(1, 8))
story.append(make_table(
    header=['Catégorie de route', 'Limite', 'Window', 'Store'],
    rows=[
        ['/api/auth/*', ('5', 'C'), ('15 min', 'C'), ('Redis', 'C')],
        ['/api/data/* (POST/PUT/DELETE)', ('30', 'C'), ('1 min', 'C'), ('Redis', 'C')],
        ['/api/data/* (GET)', ('120', 'C'), ('1 min', 'C'), ('Redis', 'C')],
        ['/api/ai/*', ('10', 'C'), ('1 min', 'C'), ('Redis', 'C')],
        ['/api/linkedin/*', ('20', 'C'), ('1 min', 'C'), ('Redis', 'C')],
    ],
    col_ratios=[0.40, 0.15, 0.20, 0.25]
))
story.append(Spacer(1, 14))

story.extend(h2("4.3 R-008 — Gestion d'erreurs API"))

story.extend(h3("Constat"))
story.append(body(
    "L'audit a relevé que de nombreuses routes API — par exemple "
    "<font name='DejaVuSans'>src/app/api/data/leads/route.ts</font> — "
    "n'emballent pas leurs appels Prisma dans un bloc "
    "<font name='DejaVuSans'>try/catch</font>. En cas d'erreur (contrainte "
    "unique violée, record introuvable, timeout de base de données), "
    "Next.js renvoie une réponse HTTP 500 générique avec le message "
    "d'erreur Prisma en clair — ce qui peut divulguer des informations "
    "sur le schéma (noms de colonnes, relations) à un attaquant. "
    "L'absence de format d'erreur structuré complique également la vie "
    "des consommateurs frontend qui ne peuvent pas distinguer une erreur "
    "client (400) d'une erreur serveur (500)."
))

story.extend(h3("Recommandation"))
story.append(body(
    "Créer un wrapper <font name='DejaVuSans'>withErrorHandler(handler)</font> "
    "qui emballe systématiquement le handler de chaque route. Ce wrapper "
    "capture les erreurs Prisma connues (P2002 unique constraint → 409, "
    "P2025 record not found → 404, P1001 timeout → 503) et renvoie un "
    "format JSON normalisé <font name='DejaVuSans'>{ error: { code, message, "
    "details? } }</font>. Logger les erreurs 500 via le logger structuré "
    "avec un identifiant de corrélation. Ne jamais renvoyer le message "
    "Prisma brut en production. Migrer les routes existantes une par une "
    "(une route = un commit pour faciliter la review)."
))

story.extend(h2("4.4 R-009 — Stratégie de test"))

story.extend(h3("Constat"))
story.append(body(
    "Le projet ne contient aucun test automatisé : zéro fichier "
    "<font name='DejaVuSans'>.test.ts</font>, aucun framework de test "
    "installé (pas de Vitest, Jest, Playwright ou Testing Library), aucune "
    "commande de test dans <font name='DejaVuSans'>package.json</font>. "
    "Cette absence de couverture rend chaque refactor risqué : une "
    "régression peut être introduite sans être détectée jusqu'à la "
    "production. Elle bloque également toute contribution externe — un "
    "dévelopateur ne pouvant pas vérifier que son changement ne casse "
    "rien, la revue de code devient le seul filet de sécurité, ce qui "
    "ne scale pas."
))

story.extend(h3("Recommandation"))
story.append(body(
    "Adopter une stratégie de test en trois couches complémentaires. "
    "Couche unitaire avec Vitest pour les fonctions pures "
    "(<font name='DejaVuSans'>format.ts</font>, <font name='DejaVuSans'>utils.ts</font>, "
    "moteurs lib isolés via mock Prisma). Couche d'intégration avec Vitest "
    "+ une base de test SQLite en mémoire pour valider les routes API "
    "complètes. Couche end-to-end avec Playwright pour les parcours "
    "critiques (login, création de lead, génération de post, programmation). "
    "Cible initiale : 60 % de couverture sur <font name='DejaVuSans'>src/lib</font>, "
    "40 % sur <font name='DejaVuSans'>src/app/api</font>, 5 parcours E2E. "
    "Ajouter une étape CI GitHub Actions qui lance les tests sur chaque "
    "pull request et bloque la fusion si la couverture baisse."
))

story.append(Spacer(1, 8))
story.append(make_table(
    header=['Couche', 'Outil', 'Cible couverture', 'Délai'],
    rows=[
        ['Unitaire', ('Vitest', 'C'), ('60% sur lib', 'C'), ('S2', 'C')],
        ['Intégration', ('Vitest + SQLite', 'C'), ('40% sur API', 'C'), ('S3', 'C')],
        ['E2E', ('Playwright', 'C'), ('5 parcours clés', 'C'), ('S4', 'C')],
        ['CI', ('GitHub Actions', 'C'), ('100% PRs', 'C'), ('S2', 'C')],
    ],
    col_ratios=[0.20, 0.25, 0.30, 0.25]
))
story.append(Spacer(1, 14))

story.extend(h2("4.5 R-010 — Headers de sécurité"))

story.extend(h3("Constat"))
story.append(body(
    "Le middleware ajoute trois en-têtes : "
    "<font name='DejaVuSans'>X-Frame-Options: DENY</font>, "
    "<font name='DejaVuSans'>X-Content-Type-Options: nosniff</font>, "
    "et <font name='DejaVuSans'>Referrer-Policy: strict-origin-when-cross-origin</font>. "
    "C'est un minimum viable, mais il manque quatre en-têtes critiques : "
    "<font name='DejaVuSans'>Content-Security-Policy</font> qui prévient les "
    "attaques XSS, <font name='DejaVuSans'>Strict-Transport-Security</font> "
    "qui force HTTPS, <font name='DejaVuSans'>Permissions-Policy</font> qui "
    "limite l'utilisation des API navigateur (caméra, micro, géoloc), et "
    "<font name='DejaVuSans'>X-DNS-Prefetch-Control</font> qui contrôle le "
    "pré-resolve DNS."
))

story.extend(h3("Recommandation"))
story.append(body(
    "Ajouter les quatre en-têtes manquants dans le middleware. Pour la CSP, "
    "commencer en mode <font name='DejaVuSans'>report-only</font> pendant "
    "deux semaines pour collecter les violations sans casser l'application, "
    "puis basculer en mode bloquant. Schéma recommandé : "
    "<font name='DejaVuSans'>default-src 'self'; script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; "
    "connect-src 'self' https://api.linkedin.com https://googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'</font>. "
    "HSTS : <font name='DejaVuSans'>max-age=63072000; includeSubDomains; preload</font>. "
    "Permissions-Policy : désactiver caméra, micro, géoloc, payment."
))

story.append(PageBreak())

# ============ CHAPITRE 5 — Recommandations P2 ============
story.extend(h1("5. Recommandations P2 — Moyennes"))

story.append(body(
    "Les recommandations P2 relèvent de l'amélioration continue. Elles ne "
    "sont pas bloquantes mais contribuent significativement à la "
    "maintenabilité, la performance et l'expérience développeur. Elles "
    "peuvent être absorbées par l'équipe produit au fil de l'eau, idéalement "
    "en réservant 20 % du temps de chaque sprint à la dette technique."
))

story.extend(h2("5.1 R-011 — Éliminer les types any"))

story.append(body(
    "Le codebase contient 87 occurrences du type <font name='DejaVuSans'>any</font> "
    "réparties sur 30 fichiers, concentrées principalement dans les routes "
    "API (<font name='DejaVuSans'>export/route.ts</font> en compte 19 à lui "
    "seul) et dans les moteurs <font name='DejaVuSans'>notifications</font>, "
    "<font name='DejaVuSans'>feedback</font> et <font name='DejaVuSans'>workflow</font>. "
    "Le type <font name='DejaVuSans'>any</font> désactive la vérification de "
    "types, ce qui masque les bugs potentiels et empêche l'IDE de proposer "
    "des autocomplétions pertinentes. La strategy : remplacer chaque "
    "<font name='DejaVuSans'>any</font> par un type précis (interface, type "
    "alias, ou <font name='DejaVuSans'>unknown</font> avec narrowing), "
    "un fichier à la fois, en s'aidant du compilateur pour détecter les "
    "régressions. L'objectif réeliste est de passer sous 20 occurrences "
    "en un trimestre."
))

story.extend(h2("5.2 R-012 — Activer l'optimisation d'images"))

story.append(body(
    "La configuration <font name='DejaVuSans'>images.unoptimized = true</font> "
    "désactive le service d'optimisation d'images de Next.js. Conséquence : "
    "chaque image envoyée au navigateur l'est dans sa résolution et son "
    "format d'origine. Sur une page dashboard contenant des screenshots, "
    "des avatars et des illustrations, cela peut représenter plusieurs "
    "mégaoctets transférés inutilement. Pour réactiver : supprimer la "
    "ligne <font name='DejaVuSans'>unoptimized</font> et configurer "
    "<font name='DejaVuSans'>images.remotePatterns</font> avec la liste "
    "blanche des domaines externes (LinkedIn, Google avatars, etc.). Si "
    "l'hébergeur ne supporte pas l'optimisation serverless (Netlify), "
    "utiliser le loader <font name='DejaVuSans'>imgix</font> ou "
    "<font name='DejaVuSans'>cloudinary</font>."
))

story.extend(h2("5.3 R-013 — Optimiser ensureDefaultUser"))

story.append(body(
    "La fonction <font name='DejaVuSans'>ensureDefaultUser()</font> est "
    "appelée avant chaque opération d'écriture dans les routes API. Elle "
    "exécute un <font name='DejaVuSans'>findUnique</font> puis potentiellement "
    "un <font name='DejaVuSans'>create</font> sur la table User. Cela "
    "ajoute un round-trip base de données systématique — environ 5 à 15 ms "
    "par requête — ce qui dégrade le p99 latence et consomme inutilement "
    "des connexions. La correction : exécuter cette fonction une seule "
    "fois au démarrage de l'application (dans "
    "<font name='DejaVuSans'>instrumentation.ts</font> fourni par Next.js) "
    "ou via un script de seed exécuté au déploiement. À terme, cette "
    "fonction doit disparaître complètement une fois le multi-tenant "
    "réel en place (R-002)."
))

story.extend(h2("5.4 R-014 — Consolider la configuration de déploiement"))

story.append(body(
    "Le dépôt contient cinq fichiers de configuration de déploiement "
    "distincts : <font name='DejaVuSans'>render.yaml</font>, "
    "<font name='DejaVuSans'>netlify.toml</font>, "
    "<font name='DejaVuSans'>docker-compose.yml</font>, "
    "<font name='DejaVuSans'>build.sh</font>, "
    "<font name='DejaVuSans'>Caddyfile</font>. Cette pluralité crée une "
    "confusion sur la cible de production officielle et multiplie les "
    "risques de divergence de configuration. Recommandation : choisir une "
    "cible unique (Render pour la simplicité, ou Docker + Caddy pour la "
    "maîtrise), supprimer les fichiers obsolètes, et documenter le choix "
    "retenu dans un fichier <font name='DejaVuSans'>DEPLOYMENT.md</font> à "
    "la racine du dépôt."
))

story.extend(h2("5.5 Améliorations transverses"))

story.append(body(
    "Au-delà des risques identifiés, plusieurs améliorations transverses "
    "pourraient être conduites en parallèle sans attendre. Mise en place "
    "d'un <font name='DejaVuSans'>pre-commit</font> avec husky + lint-staged "
    "pour exécuter ESLint et Prettier sur les fichiers modifiés. Adoption "
    "d'une convention de commit (Conventional Commits) pour faciliter la "
    "génération automatique de changelogs. Documentation des décisions "
    "architecturales via ADR (Architecture Decision Records) dans un "
    "dossier <font name='DejaVuSans'>docs/adr/</font>. Mise en place d'un "
    "tableau de bord d'observabilité (Grafana Cloud gratuit) exposant les "
    "métriques clés : latence p50/p95/p99 des routes API, taux d'erreur, "
    "débit, taille de la base."
))

story.append(PageBreak())

# ============ CHAPITRE 6 — Plan de mise en œuvre ============
story.extend(h1("6. Plan de mise en œuvre"))

story.extend(h2("6.1 Roadmap 12 semaines"))
story.append(body(
    "La roadmap ci-dessous séquence les recommandations sur douze semaines "
    "en quatre phases. Chaque phase produit un livrable démontrable qui "
    "peut être présenté en revue de direction. Les efforts sont estimés en "
    "jours-homme sur la base d'un développeur senior connaissant le "
    "codebase ; un développeur junior devra multiplier par 1,5 à 2."
))

story.append(Spacer(1, 8))
story.append(make_table(
    header=['Semaine', 'Phase', 'Activité', 'Effort (jh)', 'Livrable'],
    rows=[
        [('S1-S2', 'C'), ('Phase 1 — P0', 'C'), ('Auth réelle + multi-tenant', 'C'), ('8', 'C'), ('PR auth + tests isol.', 'C')],
        [('S3', 'C'), ('Phase 1 — P0', 'C'), ('Désactiver ignoreBuildErrors + fix TS', 'C'), ('4', 'C'), ('Build propre', 'C')],
        [('S4', 'C'), ('Phase 2 — DB', 'C'), ('Aligner provider + migrations', 'C'), ('1', 'C'), ('Schéma cohérent', 'C')],
        [('S4', 'C'), ('Phase 2 — DB', 'C'), ('Désactiver log:query en prod', 'C'), ('0.5', 'C'), ('Logs propres', 'C')],
        [('S5-S6', 'C'), ('Phase 2 — Sécurité', 'C'), ('Rate-limit Redis + headers CSP/HSTS', 'C'), ('4', 'C'), ('Middleware renforcé', 'C')],
        [('S6-S7', 'C'), ('Phase 2 — Résilience', 'C'), ('withErrorHandler + migration routes', 'C'), ('5', 'C'), ('API résiliente', 'C')],
        [('S7-S9', 'C'), ('Phase 3 — Tests', 'C'), ('Vitest setup + tests lib', 'C'), ('8', 'C'), ('Couverture 60% lib', 'C')],
        [('S9-S10', 'C'), ('Phase 3 — Tests', 'C'), ('Tests API + 5 parcours E2E', 'C'), ('6', 'C'), ('CI bloquante', 'C')],
        [('S10-S12', 'C'), ('Phase 4 — Dette', 'C'), ('Réduction des any + optimisation images', 'C'), ('5', 'C'), ('Code plus propre', 'C')],
        [('S12', 'C'), ('Phase 4 — Dette', 'C'), ('Consolidation config déploiement', 'C'), ('2', 'C'), ('DEPLOYMENT.md', 'C')],
    ],
    col_ratios=[0.10, 0.16, 0.34, 0.10, 0.30]
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "<i>Tableau 3 — Roadmap séquentielle sur 12 semaines avec livrables intermédiaires.</i>",
    sMeta
))
story.append(Spacer(1, 14))

story.extend(h2("6.2 Quick wins (semaine 1)"))
story.append(body(
    "Trois actions peuvent être menées dès la première semaine avec un "
    "effort minimal et un effet immédiat sur la sécurité et la qualité. "
    "Ces quick wins ne nécessitent aucune dépendance externe et peuvent "
    "être livrés en un seul commit chacun."
))

story.append(bullet(
    "<b>Désactiver <font name='DejaVuSans'>ignoreBuildErrors</font></b> "
    "et corriger les 5 erreurs TypeScript les plus bloquantes — 4 heures, "
    "impact qualité immédiat."
))
story.append(bullet(
    "<b>Ajouter les en-têtes CSP, HSTS, Permissions-Policy</b> dans le "
    "middleware en mode report-only — 1 heure, impact sécurité élevé."
))
story.append(bullet(
    "<b>Supprimer le fallback <font name='DejaVuSans'>NEXTAUTH_SECRET</font></b> "
    "et lancer une exception au démarrage si absent — 30 minutes, impact "
    "sécurité critique."
))
story.append(Spacer(1, 10))

story.extend(h2("6.3 Effort cumulé par phase"))
story.append(Spacer(1, 6))
story.append(make_table(
    header=['Phase', 'Période', 'Effort (jh)', '% total', 'Effet'],
    rows=[
        [('Phase 1 — P0', 'C'), ('S1-S3', 'C'), ('12', 'C'), ('27%', 'C'), ('Sécurité bloquante', 'C')],
        [('Phase 2 — DB/Sécu/Résilience', 'C'), ('S4-S7', 'C'), ('10.5', 'C'), ('24%', 'C'), ('Industrialisation', 'C')],
        [('Phase 3 — Tests', 'C'), ('S7-S10', 'C'), ('14', 'C'), ('32%', 'C'), ('Régression maîtrisée', 'C')],
        [('Phase 4 — Dette', 'C'), ('S10-S12', 'C'), ('7', 'C'), ('16%', 'C'), ('Maintenabilité', 'C')],
        [('Total', 'C'), ('S1-S12', 'C'), ('43.5', 'C'), ('100%', 'C'), ('Niveau « Défini »', 'C')],
    ],
    col_ratios=[0.28, 0.14, 0.14, 0.14, 0.30]
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "<i>Tableau 4 — Répartition de l'effort total estimé à 43,5 jours-homme.</i>",
    sMeta
))

story.append(PageBreak())

# ============ CHAPITRE 7 — Conclusion ============
story.extend(h1("7. Conclusion et prochaines étapes"))

story.extend(h2("7.1 Bilan"))
story.append(body(
    "HERMÈS est une plateforme techniquement ambitieuse qui démontre une "
    "excellente compréhension des besoins métier de l'automatisation "
    "LinkedIn B2B. La richesse fonctionnelle — orchestrateur d'agents, "
    "workflow engine, A/B testing, conformité, CRM intégré — est "
    "remarquable pour un projet de cette envergure. L'architecture "
    "modulaire, avec neuf moteurs lib indépendants et persistance Prisma, "
    "est saine et facile à étendre. La récente migration des stores "
    "in-memory vers la base de données (BUG-H2) témoigne d'une capacité "
    "d'amélioration continue déjà à l'œuvre."
))
story.append(body(
    "Cependant, le projet porte encore les stigmates d'un développement "
    "itératif rapide : l'authentification démo n'a jamais été remplacée, "
    "le multi-tenant a été différé, et la chaîne de build a été désamorcée "
    "pour avancer plus vite. Ces raccourcis étaient légitimes en phase "
    "d'exploration, mais deviennent des blockers dès lors que l'on "
    "envisage une mise en production ou une démonstration à des "
    "clients entreprise. L'audit a identifié trois risques P0 qui "
    "représentent environ deux semaines de travail — un investissement "
    "modeste au regard du débloquage de toute la roadmap d'industrialisation."
))

story.extend(h2("7.2 Prochaines étapes recommandées"))
story.append(body(
    "La séquence d'action recommandée est la suivante. Premièrement, "
    "valider publiquement ce rapport avec l'équipe technique et "
    "arbitrer les priorités en fonction du contexte business (levée, "
    "signature client, date de lancement). Deuxièmement, planifier un "
    "sprint P0 dédié de deux semaines sans aucune autre tâche produit "
    "pour absorber les correctifs R-001, R-002 et R-003. Troisièmement, "
    "mettre en place la pipeline CI (GitHub Actions) avec "
    "<font name='DejaVuSans'>tsc --noEmit</font>, ESLint et les premiers "
    "tests Vitest dès la fin du sprint P0. Quatrièmement, conduire un "
    "audit de pénétration externe après la phase 2 pour valider "
    "indépendamment la surface d'attaque. Cinquièmement, planifier un "
    "second audit interne dans six mois pour mesurer la progression "
    "vers le niveau de maturité « Maîtrisé »."
))

story.extend(h2("7.3 Indicateurs de succès"))
story.append(body(
    "Pour mesurer l'efficacité du plan de mise en œuvre, trois "
    "indicateurs clés sont recommandés. Le taux de couverture de tests "
    "doit passer de 0 % à 60 % sur <font name='DejaVuSans'>src/lib</font> "
    "et 40 % sur <font name='DejaVuSans'>src/app/api</font> d'ici la "
    "fin de la phase 3. Le nombre de vulnérabilités critiques détectées "
    "par un scan automatisé (Snyk, Dependabot, OWASP ZAP) doit tomber à "
    "zéro après la phase 2. Le temps de build en CI doit rester sous "
    "5 minutes pour préserver la fluidité de développement. Ces "
    "indicateurs doivent être publiés dans un dashboard interne et "
    "revus en révue de direction mensuelle."
))

story.append(Spacer(1, 16))
story.append(callout(
    "Recommandation finale",
    "L'investissement total pour atteindre le niveau de maturité « Défini » "
    "est estimé à 43,5 jours-homme répartis sur 12 semaines, soit "
    "approximativement un développeur senior à mi-temps. C'est un "
    "investissement raisonnable au regard de l'enjeu : transformer HERMÈS "
    "d'un prototype avancé en une plateforme SaaS enterprise prêt à "
    "welcomeillir ses premiers clients payants. Le passage à l'échelle "
    "supérieure ne se fera pas sans ces fondations solides.",
    color=ACCENT
))

# ─── Build PDF ───
doc = TocDocTemplate(
    OUTPUT_BODY,
    pagesize=A4,
    leftMargin=LEFT_MARGIN,
    rightMargin=RIGHT_MARGIN,
    topMargin=TOP_MARGIN,
    bottomMargin=BOTTOM_MARGIN,
    title="HERMÈS — Audit Technique 2026 — Recommandations",
    author="Z.ai",
    creator="Z.ai",
    subject="Audit technique et recommandations stratégiques pour la plateforme HERMÈS",
)

doc.multiBuild(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(f"[ok] Body PDF generated: {OUTPUT_BODY}")

# ─── Merge cover + body ───
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89

def normalize_page_to_a4(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    # Tight tolerance: any deviation > 0.3pt gets normalized to exact A4
    if abs(w - A4_W) > 0.3 or abs(h - A4_H) > 0.3:
        page.scale_to(A4_W, A4_H)
    return page

writer = PdfWriter()
cover_pages = PdfReader(COVER_PDF).pages
for p in cover_pages:
    writer.add_page(normalize_page_to_a4(p))
body_pages = PdfReader(OUTPUT_BODY).pages
for p in body_pages:
    writer.add_page(normalize_page_to_a4(p))

writer.add_metadata({
    '/Title': 'HERMÈS — Audit Technique 2026 — Recommandations',
    '/Author': 'Z.ai',
    '/Creator': 'Z.ai',
    '/Subject': 'Audit technique et recommandations stratégiques pour la plateforme HERMÈS',
})

with open(OUTPUT_FINAL, 'wb') as f:
    writer.write(f)

print(f"[ok] Final merged PDF: {OUTPUT_FINAL}")
print(f"     Cover pages: {len(cover_pages)}")
print(f"     Body pages:  {len(body_pages)}")
print(f"     Total pages: {len(cover_pages) + len(body_pages)}")
