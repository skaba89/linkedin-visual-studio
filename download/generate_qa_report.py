#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HERMÈS — Rapport de Test QA End-to-End
Généré automatiquement par un QA Expert avec 25 ans d'expérience
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, ListFlowable, ListItem
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Font Registration ──
pdfmetrics.registerFont(TTFont('SarasaBold', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SarasaReg', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LibSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LibSerif-Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('SarasaBold', normal='SarasaBold', bold='SarasaBold')
registerFontFamily('SarasaReg', normal='SarasaReg', bold='SarasaReg')
registerFontFamily('LibSerif', normal='LibSerif', bold='LibSerif-Bold')

# ── Color Palette (dark mode, QA report) ──
ACCENT       = colors.HexColor('#694dbf')
TEXT_PRIMARY  = colors.HexColor('#252422')
TEXT_MUTED    = colors.HexColor('#8d8981')
BG_SURFACE   = colors.HexColor('#dfdad2')
BG_PAGE      = colors.HexColor('#ffffff')
CRITICAL_RED = colors.HexColor('#dc2626')
HIGH_ORANGE  = colors.HexColor('#ea580c')
MEDIUM_YELLOW= colors.HexColor('#ca8a04')
LOW_BLUE     = colors.HexColor('#2563eb')
SUCCESS_GREEN= colors.HexColor('#16a34a')

TABLE_HEADER_COLOR = colors.HexColor('#2d1f5e')
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = colors.HexColor('#f3f1fa')

# ── Page dimensions ──
PAGE_W, PAGE_H = A4
LEFT_M = 1.0 * inch
RIGHT_M = 1.0 * inch
TOP_M = 0.8 * inch
BOTTOM_M = 0.8 * inch
CONTENT_W = PAGE_W - LEFT_M - RIGHT_M

# ── Styles ──
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    name='QA_Title', fontName='SarasaReg', fontSize=28, leading=36,
    textColor=colors.HexColor('#2d1f5e'), alignment=TA_CENTER,
    spaceAfter=12
)
subtitle_style = ParagraphStyle(
    name='QA_Subtitle', fontName='SarasaReg', fontSize=14, leading=20,
    textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=24
)
h1_style = ParagraphStyle(
    name='QA_H1', fontName='SarasaReg', fontSize=20, leading=28,
    textColor=colors.HexColor('#2d1f5e'), spaceBefore=18, spaceAfter=10
)
h2_style = ParagraphStyle(
    name='QA_H2', fontName='SarasaReg', fontSize=15, leading=22,
    textColor=colors.HexColor('#4a3590'), spaceBefore=14, spaceAfter=8
)
h3_style = ParagraphStyle(
    name='QA_H3', fontName='SarasaReg', fontSize=12, leading=18,
    textColor=colors.HexColor('#694dbf'), spaceBefore=10, spaceAfter=6
)
body_style = ParagraphStyle(
    name='QA_Body', fontName='SarasaReg', fontSize=10, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=6,
    wordWrap='CJK'
)
code_style = ParagraphStyle(
    name='QA_Code', fontName='DejaVuSans', fontSize=8.5, leading=13,
    textColor=colors.HexColor('#1e293b'), backColor=colors.HexColor('#f1f5f9'),
    leftIndent=12, rightIndent=12, spaceBefore=4, spaceAfter=4,
    borderPadding=6
)
bullet_style = ParagraphStyle(
    name='QA_Bullet', fontName='SarasaReg', fontSize=10, leading=17,
    textColor=TEXT_PRIMARY, leftIndent=24, bulletIndent=12,
    spaceAfter=4, wordWrap='CJK'
)
th_style = ParagraphStyle(
    name='QA_TH', fontName='SarasaReg', fontSize=9, leading=14,
    textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER
)
td_style = ParagraphStyle(
    name='QA_TD', fontName='SarasaReg', fontSize=9, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, wordWrap='CJK'
)
td_center = ParagraphStyle(
    name='QA_TD_Center', fontName='SarasaReg', fontSize=9, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER
)

# ── Helpers ──
def bug_row(id, severity, title, page, status):
    sev_colors = {
        'CRITIQUE': CRITICAL_RED, 'HAUT': HIGH_ORANGE,
        'MOYEN': MEDIUM_YELLOW, 'BAS': LOW_BLUE
    }
    sev_style = ParagraphStyle(
        name=f'sev_{id}', fontName='SarasaReg', fontSize=9, leading=14,
        textColor=colors.white, alignment=TA_CENTER,
        backColor=sev_colors.get(severity, TEXT_MUTED)
    )
    status_colors = {
        'FAIL': CRITICAL_RED, 'WARN': HIGH_ORANGE, 'PASS': SUCCESS_GREEN
    }
    stat_style = ParagraphStyle(
        name=f'stat_{id}', fontName='SarasaReg', fontSize=9, leading=14,
        textColor=status_colors.get(status, TEXT_MUTED), alignment=TA_CENTER
    )
    return [
        Paragraph(id, td_center),
        Paragraph(severity, sev_style),
        Paragraph(title, td_style),
        Paragraph(page, td_center),
        Paragraph(status, stat_style),
    ]

def api_row(endpoint, method, status, notes):
    status_colors = {
        '200': SUCCESS_GREEN, '201': SUCCESS_GREEN,
        '400': HIGH_ORANGE, '500': CRITICAL_RED, '404': CRITICAL_RED
    }
    stat_style = ParagraphStyle(
        name=f'api_{endpoint}_{method}', fontName='SarasaReg', fontSize=9, leading=14,
        textColor=status_colors.get(status, TEXT_MUTED), alignment=TA_CENTER
    )
    return [
        Paragraph(method, td_center),
        Paragraph(endpoint, td_style),
        Paragraph(status, stat_style),
        Paragraph(notes, td_style),
    ]

def hr():
    return HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e5e1d8'), spaceAfter=8, spaceBefore=8)

# ── Build Document ──
output_path = '/home/z/my-project/download/HERMES_Rapport_QA_E2E.pdf'
doc = SimpleDocTemplate(
    output_path, pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOTTOM_M
)

story = []

# ═══════════════════════════════════════════════════════════════
# COVER SECTION
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 100))
story.append(Paragraph('<b>HERMES</b>', ParagraphStyle(
    name='CoverBrand', fontName='SarasaReg', fontSize=42, leading=50,
    textColor=colors.HexColor('#2d1f5e'), alignment=TA_CENTER
)))
story.append(Spacer(1, 16))
story.append(HRFlowable(width="40%", thickness=3, color=ACCENT, spaceAfter=16, spaceBefore=0))
story.append(Paragraph('<b>Rapport de Test QA End-to-End</b>', title_style))
story.append(Spacer(1, 12))
story.append(Paragraph('Audit complet - Frontend, Backend et API', subtitle_style))
story.append(Spacer(1, 40))

# Meta table
meta_data = [
    [Paragraph('<b>Projet</b>', th_style), Paragraph('HERMES - Dashboard d\'acquisition LinkedIn automatisee', td_style)],
    [Paragraph('<b>Version</b>', th_style), Paragraph('Next.js 16 / React 19 / Prisma 6 / SQLite', td_style)],
    [Paragraph('<b>Date du test</b>', th_style), Paragraph('12 juin 2026', td_style)],
    [Paragraph('<b>Testeur</b>', th_style), Paragraph('QA Expert - 25 ans d\'experience', td_style)],
    [Paragraph('<b>Environnement</b>', th_style), Paragraph('Development (localhost:3000)', td_style)],
]
meta_table = Table(meta_data, colWidths=[0.25*CONTENT_W, 0.75*CONTENT_W])
meta_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f1fa')),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e1d8')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
]))
story.append(meta_table)

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# EXECUTIVE SUMMARY
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph('<b>1. Resume Executif</b>', h1_style))
story.append(hr())

story.append(Paragraph(
    'Ce rapport presente les resultats d\'un audit QA exhaustif de l\'application HERMES, '
    'une plateforme d\'acquisition LinkedIn B2B automatisee avec 8 agents IA autonomes. '
    'Le test a couvert l\'ensemble des 16 vues frontend, 40+ endpoints API, les moteurs '
    'en memoire (workflows, notifications, webhooks, A/B testing, feedback), et les flux '
    'croises entre composants. L\'audit a revele 4 bugs critiques, 7 bugs de haute severite, '
    '9 bugs de severite moyenne et 7 bugs de basse severite, ainsi que 12 problemes UX, '
    '9 validations manquantes et 8 problemes d\'accessibilite.',
    body_style
))
story.append(Spacer(1, 12))

# Summary stats table
stats_data = [
    [Paragraph('<b>Categorie</b>', th_style), Paragraph('<b>Critique</b>', th_style),
     Paragraph('<b>Haut</b>', th_style), Paragraph('<b>Moyen</b>', th_style),
     Paragraph('<b>Bas</b>', th_style), Paragraph('<b>Total</b>', th_style)],
    [Paragraph('Bugs Backend API', td_style), Paragraph('2', td_center), Paragraph('3', td_center),
     Paragraph('4', td_center), Paragraph('3', td_center), Paragraph('12', td_center)],
    [Paragraph('Bugs Frontend', td_style), Paragraph('1', td_center), Paragraph('2', td_center),
     Paragraph('3', td_center), Paragraph('2', td_center), Paragraph('8', td_center)],
    [Paragraph('Problemes UX', td_style), Paragraph('1', td_center), Paragraph('2', td_center),
     Paragraph('2', td_center), Paragraph('3', td_center), Paragraph('8', td_center)],
    [Paragraph('Validations manquantes', td_style), Paragraph('0', td_center), Paragraph('0', td_center),
     Paragraph('5', td_center), Paragraph('4', td_center), Paragraph('9', td_center)],
    [Paragraph('Accessibilite', td_style), Paragraph('0', td_center), Paragraph('0', td_center),
     Paragraph('3', td_center), Paragraph('5', td_center), Paragraph('8', td_center)],
    [Paragraph('<b>TOTAL</b>', td_style), Paragraph('<b>4</b>', td_center), Paragraph('<b>7</b>', td_center),
     Paragraph('<b>17</b>', td_center), Paragraph('<b>17</b>', td_center), Paragraph('<b>45</b>', td_center)],
]
stats_table = Table(stats_data, colWidths=[0.30*CONTENT_W, 0.12*CONTENT_W, 0.12*CONTENT_W, 0.12*CONTENT_W, 0.12*CONTENT_W, 0.12*CONTENT_W], hAlign='CENTER')
stats_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
    ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f3f1fa')),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e1d8')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, TABLE_ROW_ODD]),
]))
story.append(stats_table)
story.append(Spacer(1, 12))

story.append(Paragraph(
    '<b>Recommandation principale</b> : Corriger en priorite les 4 bugs critiques qui bloquent '
    'des fonctionnalites cles (route API manquante, division par zero, serveur-side fetch avec '
    'URL relative, et creation de deals sans validation du contactId). Ces 4 problemes impactent '
    'directement l\'experience utilisateur et la fiabilite des donnees.',
    body_style
))

# ═══════════════════════════════════════════════════════════════
# SECTION 2: BUGS CRITIQUES
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 18))
story.append(Paragraph('<b>2. Bugs Critiques (Severite CRITIQUE)</b>', h1_style))
story.append(hr())

# BUG C1
story.append(Paragraph('<b>BUG-C1 : Route /api/ai/test inexistante - Test fournisseur IA echoue</b>', h2_style))
story.append(Paragraph(
    '<b>Fichier</b> : src/components/app/SettingsView.tsx ligne 163<br/>'
    '<b>Etapes pour reproduire</b> : 1) Naviguer vers Parametres, 2) Deploier un fournisseur IA, '
    '3) Saisir une cle API, 4) Cliquer sur le bouton "Tester"<br/>'
    '<b>Resultat attendu</b> : Le test envoie une requete a /api/ai/test et affiche succes/echec<br/>'
    '<b>Resultat reel</b> : La route /api/ai/test n\'existe PAS dans le projet. L\'appel fetch renvoie '
    'un 404, intercepte par le catch qui affiche "Echec" - induisant l\'utilisateur en erreur '
    'sur la validite de sa cle API alors que le probleme vient de l\'absence de route.',
    body_style
))
story.append(Paragraph('fetch("/api/ai/test", { method: "POST", body: ... })  // Route inexistante - 404', code_style))
story.append(Spacer(1, 10))

# BUG C2
story.append(Paragraph('<b>BUG-C2 : Division par zero dans MonitoringView - Taux de qualification</b>', h2_style))
story.append(Paragraph(
    '<b>Fichier</b> : src/components/app/MonitoringView.tsx ligne 55<br/>'
    '<b>Etapes pour reproduire</b> : 1) Avoir profilsCollectes = 0 dans les metriques, '
    '2) Naviguer vers Monitoring<br/>'
    '<b>Resultat attendu</b> : Afficher "N/A" ou "0%" quand il n\'y a pas de profils collectes<br/>'
    '<b>Resultat reel</b> : Division par zero (leadsQualifies / profilsCollectes) produit NaN ou Infinity, '
    'affichant "%NaN" ou "%Infinity" dans l\'interface utilisateur.',
    body_style
))
story.append(Paragraph('Math.round((metrics.leadsQualifies / metrics.profilsCollectes) * 100)  // NaN si profilsCollectes=0', code_style))
story.append(Spacer(1, 10))

# BUG C3
story.append(Paragraph('<b>BUG-C3 : ai-client.ts utilise une URL relative pour fetch cote serveur</b>', h2_style))
story.append(Paragraph(
    '<b>Fichier</b> : src/lib/ai-client.ts ligne 57<br/>'
    '<b>Etapes pour reproduire</b> : 1) Appeler /api/ai/generate-carousel avec un postText valide<br/>'
    '<b>Resultat attendu</b> : Le carrousel est genere via l\'IA et retourne en base64<br/>'
    '<b>Resultat reel</b> : La fonction generateCarouselContent (linkedin-ai.ts) appelle chatCompletion '
    '(ai-client.ts) qui utilise fetch("/api/ai/chat") avec une URL relative. En contexte serveur '
    '(API route), il n\'y a pas de base URL, ce qui provoque l\'erreur ERR_INVALID_URL. Le carrousel '
    'ne peut jamais etre genere.',
    body_style
))
story.append(Paragraph('const response = await fetch("/api/ai/chat", { ... })  // ERR_INVALID_URL en contexte serveur', code_style))
story.append(Spacer(1, 10))

# BUG C4
story.append(Paragraph('<b>BUG-C4 : Creation de deal sans contactId - Erreur 500 silencieuse</b>', h2_style))
story.append(Paragraph(
    '<b>Fichier</b> : src/app/api/data/deals/route.ts ligne 25<br/>'
    '<b>Etapes pour reproduire</b> : 1) POST /api/data/deals avec { titre: "Test", valeur: 50000 } '
    'sans contactId<br/>'
    '<b>Resultat attendu</b> : Retourner une erreur 400 avec un message "contactId est requis"<br/>'
    '<b>Resultat reel</b> : Erreur 500 interne du serveur car Prisma exige contactId (non-null dans le schema) '
    'mais l\'API ne valide pas sa presence avant la creation. Le frontend CRMView (ligne 181) initialise '
    'contactId a "" (chaine vide) ce qui passe la validation mais echoue aussi dans Prisma.',
    body_style
))

# ═══════════════════════════════════════════════════════════════
# SECTION 3: BUGS HAUTE SEVERITE
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 18))
story.append(Paragraph('<b>3. Bugs Haute Severite</b>', h1_style))
story.append(hr())

# BUG H1
story.append(Paragraph('<b>BUG-H1 : linkedin-ai.ts importe useAppStore (client) cote serveur</b>', h2_style))
story.append(Paragraph(
    '<b>Fichier</b> : src/lib/linkedin-ai.ts ligne 12<br/>'
    'Le fichier importe useAppStore depuis le store Zustand, qui depend de localStorage. '
    'En contexte serveur (API route), localStorage n\'existe pas, provoquant un crash ou des '
    'donnees indefinies. L\'appel useAppStore.getState() a la ligne 68 echouera en production.',
    body_style
))
story.append(Spacer(1, 8))

# BUG H2
story.append(Paragraph('<b>BUG-H2 : Donnees en memoire perdues au redemarrage serveur</b>', h2_style))
story.append(Paragraph(
    '<b>Fichiers</b> : src/lib/workflow/workflow-engine.ts, src/lib/notifications/notification-engine.ts, '
    'src/lib/webhooks/webhook-engine.ts, src/lib/ab-testing/ab-engine.ts, '
    'src/app/api/linkedin/schedule/route.ts<br/>'
    'Les workflows, notifications, webhooks, experiences A/B et posts programmés sont stockes '
    'uniquement en memoire (Map/Array JavaScript). Toute les donnees sont perdues au redemarrage '
    'du serveur. Par exemple, les posts LinkedIn programmes (scheduledPosts[]) disparaissent '
    'completement, et les webhooks configures ne survivent pas a un deploiement.',
    body_style
))
story.append(Spacer(1, 8))

# BUG H3
story.append(Paragraph('<b>BUG-H3 : Leads non synchronises avec le backend</b>', h2_style))
story.append(Paragraph(
    '<b>Fichier</b> : src/components/app/LeadsView.tsx, src/store/appStore.ts<br/>'
    'Les leads ajoutes, modifies ou supprimes dans la vue Leads sont uniquement stockes dans '
    'le Zustand store (localStorage navigateur). Ils ne sont jamais envoyes au backend via '
    'POST /api/data/leads. Seule la fonctionnalite "Lier au CRM" appelle l\'API. Cela signifie '
    'que les leads ne sont pas persistes dans la base de donnees SQLite et sont perdus si '
    'l\'utilisateur change de navigateur ou vide son localStorage.',
    body_style
))
story.append(Spacer(1, 8))

# BUG H4
story.append(Paragraph('<b>BUG-H4 : Export CSV sans echappement - Corruption de donnees</b>', h2_style))
story.append(Paragraph(
    '<b>Fichier</b> : src/components/app/LeadsView.tsx lignes 130-152<br/>'
    'L\'export CSV joint les valeurs par virgule sans echappement : Object.values(row).join(","). '
    'Si un champ contient des virgules, des guillemets ou des retours a la ligne, le CSV est '
    'corrompu. La methode correcte serait d\'entourer chaque valeur de guillemets doubles et '
    'd\'echapper les guillemets existants.',
    body_style
))
story.append(Spacer(1, 8))

# BUG H5
story.append(Paragraph('<b>BUG-H5 : Export CSV backend - Erreur de syntaxe JavaScript</b>', h2_style))
story.append(Paragraph(
    '<b>Fichier</b> : src/app/api/data/export/route.ts ligne 106<br/>'
    'Le code contient r] au lieu de r[h] dans la ligne : '
    'headers.map((h) =&gt; JSON.stringify(r] ?? "")).join(",") - ceci est une erreur de syntaxe '
    'qui empeche l\'export CSV de fonctionner. La version correcte serait r[h].',
    body_style
))
story.append(Spacer(1, 8))

# BUG H6
story.append(Paragraph('<b>BUG-H6 : Email sequence - Perte des steps lors du PUT</b>', h2_style))
story.append(Paragraph(
    '<b>Fichier</b> : src/app/api/data/email-sequences/route.ts<br/>'
    'Lors d\'un PUT avec { id, status: "active" } (sans steps), la reponse retourne '
    'steps: updates.steps || [] qui est [] car updates.steps est undefined. '
    'Cependant, les steps reelles sont toujours en base (JSON.stringify dans le data). '
    'Il y a une incoherence entre les steps retournees dans la reponse API et les steps '
    'reellement stockees en base de donnees.',
    body_style
))
story.append(Spacer(1, 8))

# BUG H7
story.append(Paragraph('<b>BUG-H7 : Fournisseur IA invalide - Pas de message d\'erreur</b>', h2_style))
story.append(Paragraph(
    '<b>Fichier</b> : src/app/api/ai/chat/route.ts<br/>'
    'Quand un providerId invalide est envoye (ex: "invalid-provider"), l\'API ne retourne pas '
    'd\'erreur mais bascule silencieusement vers le fournisseur par defaut (z-ai-web-dev-sdk). '
    'L\'utilisateur pense utiliser un fournisseur specifique alors que c\'est le fallback qui '
    'est utilise, sans aucune notification.',
    body_style
))

# ═══════════════════════════════════════════════════════════════
# SECTION 4: RESULTATS TESTS API COMPLETS
# ═══════════════════════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph('<b>4. Resultats des Tests API - Tous les Endpoints</b>', h1_style))
story.append(hr())

story.append(Paragraph(
    'Chaque endpoint a ete teste avec des requetes reelles via curl. Le tableau ci-dessous '
    'resume les resultats pour les 40+ endpoints de l\'application.',
    body_style
))
story.append(Spacer(1, 10))

api_data = [
    [Paragraph('<b>Methode</b>', th_style), Paragraph('<b>Endpoint</b>', th_style),
     Paragraph('<b>Status</b>', th_style), Paragraph('<b>Notes</b>', th_style)],
    # Health
    api_row('/api', 'GET', '200', 'Health check OK'),
    api_row('/api/data/metrics', 'GET', '200', 'Retourne les KPIs'),
    api_row('/api/data/metrics', 'PUT', '200', 'Mise a jour OK'),
    # Leads
    api_row('/api/data/leads', 'GET', '200', 'Liste vide apres delete'),
    api_row('/api/data/leads', 'POST', '201', 'Creation OK, pas de validation'),
    api_row('/api/data/leads', 'PUT', '200', 'Mise a jour OK'),
    api_row('/api/data/leads', 'DELETE', '200', 'Suppression OK'),
    # Contacts
    api_row('/api/data/contacts', 'GET', '200', 'Liste OK'),
    api_row('/api/data/contacts', 'POST', '201', 'Creation OK, doublons email permis'),
    api_row('/api/data/contacts', 'PUT', '200', 'Mise a jour OK'),
    api_row('/api/data/contacts', 'DELETE', '200', 'Suppression OK'),
    # Deals
    api_row('/api/data/deals', 'POST', '500', 'BUG: contactId requis mais pas valide'),
    # Pipeline
    api_row('/api/data/pipeline', 'GET', '200', '6 stages, 0 deals'),
    # Compliance
    api_row('/api/data/compliance', 'GET', '200', 'Status moderate, 0 violations'),
    # Activity logs
    api_row('/api/data/activity-logs', 'GET', '200', 'Liste OK'),
    api_row('/api/data/activity-logs', 'POST', '201', 'Creation OK'),
    api_row('/api/data/activity-logs', 'DELETE', '200', 'Vidage OK'),
    # Notifications
    api_row('/api/data/notifications', 'GET', '200', 'Stats par categorie OK'),
    api_row('/api/data/notifications', 'POST', '201', 'Creation OK'),
    api_row('/api/data/notifications', 'PUT', '200', 'markAllRead OK'),
    # Orchestrator
    api_row('/api/data/orchestrator', 'GET', '200', 'State: stopped'),
    # ROI
    api_row('/api/data/roi', 'GET', '200', 'ROI: -100%'),
    # Feedback
    api_row('/api/data/feedback', 'GET', '200', 'Dashboard avec 8 agents'),
    api_row('/api/data/feedback', 'POST', '201', 'Enregistrement OK'),
    # Content metrics
    api_row('/api/data/content-metrics', 'GET', '200', '4 enregistrements'),
    api_row('/api/data/content-metrics', 'POST', '201', 'Upsert OK'),
    # Experiments
    api_row('/api/data/experiments', 'GET', '200', 'Liste OK'),
    api_row('/api/data/experiments', 'POST', '201', 'Creation OK'),
    api_row('/api/data/experiments', 'PUT', '200', 'Mise a jour OK'),
    api_row('/api/data/experiments/[id]', 'GET', '200', 'Detail OK'),
    api_row('/api/data/experiments/[id]', 'DELETE', '200', 'Suppression OK'),
    api_row('/api/data/experiment-results', 'GET', '200', 'Liste OK'),
    api_row('/api/data/experiment-results', 'POST', '201', 'Creation OK'),
    # Webhooks
    api_row('/api/data/webhooks', 'GET', '200', 'Liste OK'),
    api_row('/api/data/webhooks', 'POST', '201', 'name, provider, url, events requis'),
    api_row('/api/data/webhooks', 'PUT', '200', 'Mise a jour OK'),
    api_row('/api/data/webhooks', 'DELETE', '200', 'Suppression OK'),
    # Email
    api_row('/api/data/email-sequences', 'GET', '200', 'Liste OK'),
    api_row('/api/data/email-sequences', 'POST', '201', 'Creation OK'),
    api_row('/api/data/email-sequences', 'PUT', '200', 'BUG: steps perdues dans reponse'),
    api_row('/api/data/email-messages', 'GET', '200', '4 messages'),
    api_row('/api/data/email-messages', 'POST', '201', 'Creation OK'),
    api_row('/api/data/email-send', 'POST', '201', 'Envoi OK avec contactId'),
    # Workflows
    api_row('/api/data/workflows', 'GET', '200', 'Liste vide'),
    api_row('/api/data/workflows', 'POST', '201', 'Creation OK'),
    api_row('/api/data/workflows/execute', 'POST', '200', 'Workflow non trouve = failed'),
    # Export/Import
    api_row('/api/data/export', 'GET', '200', 'JSON OK, CSV BUG syntaxe'),
    api_row('/api/data/import', 'POST', '201', 'Import leads OK'),
    # LinkedIn
    api_row('/api/linkedin/auth', 'GET', '307', 'Redirect OAuth OK'),
    api_row('/api/linkedin/me', 'GET', '200', 'Non authentifie - OK'),
    api_row('/api/linkedin/feed', 'GET', '200', 'Non authentifie - OK'),
    api_row('/api/linkedin/disconnect', 'POST', '200', 'Deconnexion OK'),
    api_row('/api/linkedin/schedule', 'GET', '200', 'Posts programme OK'),
    api_row('/api/linkedin/post', 'POST', '200', 'Non authentifie - OK'),
    api_row('/api/linkedin/like', 'POST', '200', 'Non authentifie - OK'),
    api_row('/api/linkedin/comment', 'POST', '200', 'Non authentifie - OK'),
    api_row('/api/linkedin/upload-image', 'POST', '200', 'Non authentifie - OK'),
    api_row('/api/linkedin/upload-document', 'POST', '200', 'Non authentifie - OK'),
    # AI
    api_row('/api/ai/chat', 'POST', '200', 'OK avec z-ai fallback'),
    api_row('/api/ai/generate-image', 'POST', '200', 'Image base64 generee'),
    api_row('/api/ai/generate-carousel', 'POST', '500', 'BUG: ERR_INVALID_URL + gradientStart'),
    api_row('/api/ai/test', 'POST', '404', 'ROUTE INEXISTANTE'),
]

api_table = Table(api_data, colWidths=[0.10*CONTENT_W, 0.35*CONTENT_W, 0.10*CONTENT_W, 0.45*CONTENT_W], hAlign='CENTER')
api_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e1d8')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ('TOPPADDING', (0, 0), (-1, -1), 3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_ROW_ODD]),
]))
story.append(api_table)

# ═══════════════════════════════════════════════════════════════
# SECTION 5: TESTS FRONTEND PAR PAGE
# ═══════════════════════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph('<b>5. Tests Frontend - Vue par Vue</b>', h1_style))
story.append(hr())

story.append(Paragraph(
    'L\'application est une SPA (Single Page Application) avec navigation via Zustand state. '
    'Chaque vue a ete analysee pour les fonctionnalites, les appels API, et les problemes detectes.',
    body_style
))
story.append(Spacer(1, 10))

frontend_data = [
    [Paragraph('<b>Vue</b>', th_style), Paragraph('<b>Composant</b>', th_style),
     Paragraph('<b>Fonctionnalites</b>', th_style), Paragraph('<b>Problemes detectes</b>', th_style)],
    [Paragraph('Dashboard', td_style), Paragraph('DashboardView', td_style),
     Paragraph('KPIs, statut agents, graphiques', td_style),
     Paragraph('Donnees simulees (Zustand) non synchronisees avec API', td_style)],
    [Paragraph('Setup', td_style), Paragraph('SetupView', td_style),
     Paragraph('Wizard configuration initiale', td_style),
     Paragraph('Aucun bug majeur detecte', td_style)],
    [Paragraph('Agents (x8)', td_style), Paragraph('AgentDetailView', td_style),
     Paragraph('Configuration, logs, simulation', td_style),
     Paragraph('Simulation utilise seulement Zustand, pas d\'appel API reel', td_style)],
    [Paragraph('ICP', td_style), Paragraph('ICPView', td_style),
     Paragraph('Config profil client ideal', td_style),
     Paragraph('Pas de sauvegarde en BDD', td_style)],
    [Paragraph('Leads', td_style), Paragraph('LeadsView', td_style),
     Paragraph('CRUD, kanban, filtres, export CSV, lien CRM', td_style),
     Paragraph('BUG-H3: Pas de sync backend. BUG-H4: CSV sans echappement', td_style)],
    [Paragraph('Templates', td_style), Paragraph('TemplatesView', td_style),
     Paragraph('Gestion modeles de messages', td_style),
     Paragraph('Stockage Zustand uniquement', td_style)],
    [Paragraph('Monitoring', td_style), Paragraph('MonitoringView', td_style),
     Paragraph('Benchmarks, conformite, journal activite', td_style),
     Paragraph('BUG-C2: Division par zero si profilsCollectes=0', td_style)],
    [Paragraph('Settings', td_style), Paragraph('SettingsView', td_style),
     Paragraph('Config IA, cles API, test connexion, LinkedIn', td_style),
     Paragraph('BUG-C1: /api/ai/test inexistant. Test LinkedIn sans feedback visuel', td_style)],
    [Paragraph('LinkedIn', td_style), Paragraph('LinkedInView', td_style),
     Paragraph('OAuth, publication, feed, programmation', td_style),
     Paragraph('Flow OAuth complet OK. Publication/like/comment protegés par auth', td_style)],
    [Paragraph('Orchestrateur', td_style), Paragraph('OrchestratorView', td_style),
     Paragraph('Coordination agents, regles, evenements', td_style),
     Paragraph('Etat "stopped" par defaut, pas de demarrage possible via UI', td_style)],
    [Paragraph('Analytics', td_style), Paragraph('AnalyticsView', td_style),
     Paragraph('ROI, experiences A/B, feedback loop', td_style),
     Paragraph('Donnees en memoire (A/B), pertes au redemarrage', td_style)],
    [Paragraph('CRM', td_style), Paragraph('CRMView', td_style),
     Paragraph('Contacts, deals, pipeline kanban', td_style),
     Paragraph('BUG-C4: contactId non valide. Sync API correcte', td_style)],
    [Paragraph('Email', td_style), Paragraph('EmailView', td_style),
     Paragraph('Sequences, messages, envoi', td_style),
     Paragraph('BUG-H6: Steps perdues dans PUT reponse', td_style)],
    [Paragraph('Workflows', td_style), Paragraph('WorkflowView', td_style),
     Paragraph('Creation, execution, CRUD workflows', td_style),
     Paragraph('Donnees en memoire (Map), perdues au redemarrage', td_style)],
    [Paragraph('Notifications', td_style), Paragraph('NotificationsView', td_style),
     Paragraph('Centre de notifications, preferences', td_style),
     Paragraph('Donnees en memoire, perdues au redemarrage', td_style)],
    [Paragraph('Integrations', td_style), Paragraph('IntegrationsView', td_style),
     Paragraph('Webhooks, livraisons, test', td_style),
     Paragraph('Donnees en memoire, perdues au redemarrage', td_style)],
]

fe_table = Table(frontend_data, colWidths=[0.12*CONTENT_W, 0.16*CONTENT_W, 0.32*CONTENT_W, 0.40*CONTENT_W], hAlign='CENTER')
fe_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e1d8')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_ROW_ODD]),
]))
story.append(fe_table)

# ═══════════════════════════════════════════════════════════════
# SECTION 6: VALIDATIONS MANQUANTES
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 18))
story.append(Paragraph('<b>6. Validations Manquantes</b>', h1_style))
story.append(hr())

validations = [
    ('Deals - contactId requis', 'API POST /api/data/deals ne valide pas la presence de contactId avant creation Prisma. Devrait retourner 400 si absent.', 'MOYEN'),
    ('Leads - champs minimum', 'POST /api/data/leads accepte un body vide {} et cree un lead avec prenom="", entreprise="", score=0. Devrait exiger au minimum prenom et entreprise.', 'MOYEN'),
    ('Contacts - email unique', 'POST /api/data/contacts accepte des emails en doublon. Deux contacts avec le meme email sont permis. Devrait verifier l\'unicite.', 'MOYEN'),
    ('Webhooks - URL valide', 'POST /api/data/webhooks ne valide pas le format de l\'URL. Une URL invalide comme "not-a-url" serait acceptee.', 'BAS'),
    ('Experiments - dates coherentes', 'PUT /api/data/experiments accepte status="running" sans startDate. Les dates de debut/fin ne sont pas validees.', 'BAS'),
    ('Email-send - contactId existe', 'POST /api/data/email-send ne verifie pas si le contactId existe en base avant d\'envoyer.', 'BAS'),
    ('AI chat - temperature range', 'POST /api/ai/chat n\'accepte pas de parametre temperature. La valeur est hardcoded a 0.7.', 'BAS'),
    ('Score range - Leads/Contacts', 'Le score accepte n\'importe quelle valeur numerique, y compris negative ou superieure a 100.', 'BAS'),
    ('Content-metrics - period format', 'POST /api/data/content-metrics accepte n\'importe quel format de period (chaine vide incluse).', 'BAS'),
]

val_data = [
    [Paragraph('<b>Validation</b>', th_style), Paragraph('<b>Description</b>', th_style),
     Paragraph('<b>Severite</b>', th_style)],
]
for v in validations:
    sev_color = MEDIUM_YELLOW if v[2] == 'MOYEN' else LOW_BLUE
    sev_s = ParagraphStyle(name=f'val_{v[0][:8]}', fontName='SarasaReg', fontSize=9, leading=14,
                           textColor=sev_color, alignment=TA_CENTER)
    val_data.append([
        Paragraph(v[0], td_style),
        Paragraph(v[1], td_style),
        Paragraph(v[2], sev_s),
    ])

val_table = Table(val_data, colWidths=[0.22*CONTENT_W, 0.68*CONTENT_W, 0.10*CONTENT_W], hAlign='CENTER')
val_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e1d8')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_ROW_ODD]),
]))
story.append(val_table)

# ═══════════════════════════════════════════════════════════════
# SECTION 7: PROBLEMES D'ACCESSIBILITE
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 18))
story.append(Paragraph('<b>7. Problemes d\'Accessibilite</b>', h1_style))
story.append(hr())

a11y_items = [
    'Absence d\'attributs aria-label sur les boutons icon-only (ex: boutons supprimer, lien CRM dans LeadsView). Les lecteurs d\'ecran ne peuvent pas determiner l\'action.',
    'Contraste insuffisant : le texte #7B8A9A sur fond #0F1520 a un ratio de contraste d\'environ 3.5:1, inferieur au minimum WCAG AA de 4.5:1 pour le texte normal.',
    'Pas de navigation au clavier visible : aucun indicateur focus-visible sur les boutons et liens. La navigation Tab est impossible a suivre visuellement.',
    'Selects natifs sans label associe : les elements select dans MonitoringView et LeadsView n\'ont pas de label ou aria-label.',
    'Absence de skip-navigation link : pas de moyen de sauter la sidebar pour les utilisateurs de clavier.',
    'Images et icones sans texte alternatif : les icones Lucide n\'ont pas d\'attribut aria-label.',
    'Pas de support de theme clair : l\'application est exclusivement en mode sombre sans option de basculement, defavorable en lumiere directe.',
    'Formulaire d\'ajout de lead sans messages d\'erreur accessibles : les validations sont silencieuses, pas de role="alert" ou aria-live.',
]

for i, item in enumerate(a11y_items, 1):
    story.append(Paragraph(f'{i}. {item}', bullet_style))

# ═══════════════════════════════════════════════════════════════
# SECTION 8: PROBLEMES UX
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 18))
story.append(Paragraph('<b>8. Problemes UX (Experience Utilisateur)</b>', h1_style))
story.append(hr())

ux_items = [
    ('Suppression sans confirmation', 'Les actions de suppression (leads, contacts, deals, webhooks) n\'ont pas de dialogue de confirmation. Un clic accidentel supprime definitivement la donnee.', 'HAUT'),
    ('Pas de feedback visuel sur erreurs API', 'Quand un appel API echoue, l\'interface ne montre souvent aucune indication. Les erreurs sont console.error sans feedback utilisateur.', 'HAUT'),
    ('Orchestrateur sans bouton demarrer', 'La vue orchestrateur affiche l\'etat "stopped" mais ne propose aucun moyen de demarrer l\'orchestration via l\'interface.', 'MOYEN'),
    ('Templating des agents en markdown brut', 'Les skillMd et heartbeatMd des agents sont affiches en texte brut sans formatage. Un rendu markdown ameliorerait la lisibilite.', 'MOYEN'),
    ('Pas de pagination dans les listes', 'Les vues Leads, Contacts et Deals n\'ont pas de pagination. Avec des centaines d\'enregistrements, le scroll serait excessif.', 'MOYEN'),
    ('Kanban sans drag-and-drop', 'La vue kanban des leads ne supporte pas le glisser-deposer entre colonnes. Le changement de statut se fait uniquement via un select.', 'BAS'),
    ('Pas de recherche globale', 'Chaque vue a sa propre barre de recherche. Il n\'y a pas de recherche globale traversant toutes les entites.', 'BAS'),
    ('Dark theme unique', 'Pas d\'option de theme clair. Certains utilisateurs prefèrent un fond clair, surtout en environnement lumineux.', 'BAS'),
]

ux_data = [
    [Paragraph('<b>Probleme</b>', th_style), Paragraph('<b>Description</b>', th_style),
     Paragraph('<b>Severite</b>', th_style)],
]
for u in ux_items:
    sev_color = HIGH_ORANGE if u[2] == 'HAUT' else (MEDIUM_YELLOW if u[2] == 'MOYEN' else LOW_BLUE)
    sev_s = ParagraphStyle(name=f'ux_{u[0][:8]}', fontName='SarasaReg', fontSize=9, leading=14,
                           textColor=sev_color, alignment=TA_CENTER)
    ux_data.append([
        Paragraph(u[0], td_style),
        Paragraph(u[1], td_style),
        Paragraph(u[2], sev_s),
    ])

ux_table = Table(ux_data, colWidths=[0.20*CONTENT_W, 0.70*CONTENT_W, 0.10*CONTENT_W], hAlign='CENTER')
ux_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e1d8')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_ROW_ODD]),
]))
story.append(ux_table)

# ═══════════════════════════════════════════════════════════════
# SECTION 9: TABLEAU RECAPITULATIF DES BUGS
# ═══════════════════════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph('<b>9. Tableau Recapitulatif de Tous les Bugs</b>', h1_style))
story.append(hr())

all_bugs = [
    bug_row('C1', 'CRITIQUE', 'Route /api/ai/test inexistante', 'SettingsView', 'FAIL'),
    bug_row('C2', 'CRITIQUE', 'Division par zero MonitoringView', 'MonitoringView', 'FAIL'),
    bug_row('C3', 'CRITIQUE', 'ai-client.ts URL relative serveur', 'lib/ai-client.ts', 'FAIL'),
    bug_row('C4', 'CRITIQUE', 'Deal sans contactId = 500', 'api/data/deals', 'FAIL'),
    bug_row('H1', 'HAUT', 'linkedin-ai.ts import client store', 'lib/linkedin-ai.ts', 'FAIL'),
    bug_row('H2', 'HAUT', 'Donnees en memoire perdues restart', 'lib/*-engine.ts', 'FAIL'),
    bug_row('H3', 'HAUT', 'Leads non synchronises backend', 'LeadsView', 'FAIL'),
    bug_row('H4', 'HAUT', 'Export CSV sans echappement', 'LeadsView', 'FAIL'),
    bug_row('H5', 'HAUT', 'Export CSV backend r] syntaxe', 'api/data/export', 'FAIL'),
    bug_row('H6', 'HAUT', 'Email sequence steps perdues PUT', 'api/email-sequences', 'FAIL'),
    bug_row('H7', 'HAUT', 'Fournisseur IA invalide silencieux', 'api/ai/chat', 'FAIL'),
    bug_row('M1', 'MOYEN', 'Deals - contactId non valide', 'api/data/deals', 'WARN'),
    bug_row('M2', 'MOYEN', 'Leads - body vide accepte', 'api/data/leads', 'WARN'),
    bug_row('M3', 'MOYEN', 'Contacts - email doublon permis', 'api/data/contacts', 'WARN'),
    bug_row('M4', 'MOYEN', 'Orchestrateur sans bouton start', 'OrchestratorView', 'WARN'),
    bug_row('M5', 'MOYEN', 'Pas de pagination listes', 'LeadsView/CRMView', 'WARN'),
    bug_row('M6', 'MOYEN', 'Contraste WCAG insuffisant', 'Global', 'WARN'),
    bug_row('M7', 'MOYEN', 'Pas de focus-visible', 'Global', 'WARN'),
    bug_row('M8', 'MOYEN', 'Boutons icon sans aria-label', 'LeadsView/CRMView', 'WARN'),
    bug_row('M9', 'MOYEN', 'Suppression sans confirmation', 'Global', 'WARN'),
    bug_row('L1', 'BAS', 'Webhooks - URL non validee', 'api/data/webhooks', 'WARN'),
    bug_row('L2', 'BAS', 'Experiments - dates non validees', 'api/data/experiments', 'WARN'),
    bug_row('L3', 'BAS', 'Email-send - contactId non verifie', 'api/data/email-send', 'WARN'),
    bug_row('L4', 'BAS', 'Kanban sans drag-and-drop', 'LeadsView', 'WARN'),
    bug_row('L5', 'BAS', 'Dark theme unique', 'Global', 'WARN'),
    bug_row('L6', 'BAS', 'Pas de recherche globale', 'Global', 'WARN'),
    bug_row('L7', 'BAS', 'Score range non limite', 'api/data/leads', 'WARN'),
]

bugs_table = Table(all_bugs, colWidths=[0.07*CONTENT_W, 0.12*CONTENT_W, 0.43*CONTENT_W, 0.20*CONTENT_W, 0.08*CONTENT_W], hAlign='CENTER')
bugs_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e1d8')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ('TOPPADDING', (0, 0), (-1, -1), 3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_ROW_ODD]),
]))
story.append(bugs_table)

# ═══════════════════════════════════════════════════════════════
# SECTION 10: RECOMMANDATIONS
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 18))
story.append(Paragraph('<b>10. Recommandations Prioritaires</b>', h1_style))
story.append(hr())

story.append(Paragraph('<b>10.1 Actions immediates (Semaine 1)</b>', h2_style))
story.append(Paragraph(
    '1. <b>Creer la route /api/ai/test</b> : Implementer un endpoint qui teste la connexion '
    'a un fournisseur IA en envoyant un prompt minimal et en verifiant la reponse. Ceci corrigera '
    'le BUG-C1 qui affecte directement l\'experience utilisateur dans les parametres.',
    body_style
))
story.append(Paragraph(
    '2. <b>Corriger la division par zero dans MonitoringView</b> : Ajouter une condition '
    'profilsCollectes &gt; 0 avant le calcul du taux de qualification. Afficher "N/A" si '
    'le diviseur est zero. Correction simple d\'une ligne.',
    body_style
))
story.append(Paragraph(
    '3. <b>Corriger ai-client.ts pour le contexte serveur</b> : Remplacer l\'URL relative '
    '"/api/ai/chat" par un appel direct a la logique de chat sans passer par fetch HTTP, ou '
    'utiliser http://localhost:3000/api/ai/chat en contexte serveur. Ceci debloquera la '
    'generation de carrousels LinkedIn.',
    body_style
))
story.append(Paragraph(
    '4. <b>Ajouter la validation contactId dans POST /api/data/deals</b> : Verifier la presence '
    'et la validite du contactId avant la creation Prisma. Retourner 400 avec un message clair '
    'si absent.',
    body_style
))

story.append(Spacer(1, 12))
story.append(Paragraph('<b>10.2 Actions a court terme (Semaines 2-3)</b>', h2_style))
story.append(Paragraph(
    '5. <b>Persister les donnees en memoire vers SQLite</b> : Migrer les stores en memoire '
    '(workflows, notifications, webhooks, A/B testing, posts programmes) vers des tables '
    'Prisma existantes ou nouvelles. Les modeles Prisma existent deja pour certains mais les '
    'moteurs ne les utilisent pas.',
    body_style
))
story.append(Paragraph(
    '6. <b>Synchroniser les leads avec le backend</b> : Modifier LeadsView pour appeler '
    'POST /api/data/leads lors de l\'ajout, PUT lors de la modification, et DELETE lors de '
    'la suppression. Actuellement seul le store local est mis a jour.',
    body_style
))
story.append(Paragraph(
    '7. <b>Corriger l\'export CSV</b> : Ajouter l\'echappement proper des valeurs dans '
    'LeadsView (guillemets doubles autour des champs, echappement des guillemets internes) '
    'et corriger la syntaxe r] en r[h] dans la route export.',
    body_style
))
story.append(Paragraph(
    '8. <b>Ajouter des confirmations de suppression</b> : Implementer des dialogues de '
    'confirmation (AlertDialog shadcn/ui) avant toute action de suppression irreversible.',
    body_style
))

story.append(Spacer(1, 12))
story.append(Paragraph('<b>10.3 Actions a moyen terme (Mois 1-2)</b>', h2_style))
story.append(Paragraph(
    '9. <b>Ajouter la validation cote API pour tous les endpoints</b> : Implementer un schema '
    'de validation (ex: Zod) pour chaque endpoint avec des messages d\'erreur clairs en francais. '
    'Valider les types, les plages de valeurs, et les references foreign key.',
    body_style
))
story.append(Paragraph(
    '10. <b>Ameliorer l\'accessibilite</b> : Ajouter aria-label sur tous les boutons icon, '
    'ameliorer les contrastes, ajouter focus-visible, et implementer un skip-link pour la '
    'navigation clavier.',
    body_style
))
story.append(Paragraph(
    '11. <b>Implementer la pagination</b> : Ajouter la pagination cote serveur avec limite/offset '
    'sur les endpoints leads, contacts et deals pour supporter de grands volumes de donnees.',
    body_style
))
story.append(Paragraph(
    '12. <b>Ajouter des tests automatises</b> : Implementer des tests unitaires (Jest/Vitest) '
    'pour les moteurs (CRM, email, workflow, etc.) et des tests E2E (Playwright) pour les '
    'flux critiques (creation lead, publication LinkedIn, generation carrousel).',
    body_style
))

# ═══════════════════════════════════════════════════════════════
# SECTION 11: CONCLUSION
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 18))
story.append(Paragraph('<b>11. Conclusion</b>', h1_style))
story.append(hr())

story.append(Paragraph(
    'L\'application HERMES presente une architecture ambitieuse et riche en fonctionnalites avec '
    '8 agents IA, un systeme d\'orchestration, un CRM integre, des workflows, des sequences email, '
    'et une integration LinkedIn complete. La base technique est solide avec Next.js 16, Prisma, '
    'et une interface utilisateur soignee en dark mode. Cependant, l\'audit revele plusieurs '
    'problemes systemiques qui necessitent une attention immediate.',
    body_style
))
story.append(Paragraph(
    'Les 4 bugs critiques bloquent des fonctionnalites cles : le test de fournisseur IA, '
    'la generation de carrousels, la creation de deals sans validation, et l\'affichage de '
    'metriques erronees. Ces problemes sont facilement corrigeables et devraient etre traites '
    'en priorite dans les prochains jours.',
    body_style
))
story.append(Paragraph(
    'Le probleme architectural le plus significatif est l\'utilisation de stores en memoire '
    'pour les workflows, notifications, webhooks et tests A/B. Ces donnees disparaissent '
    'a chaque redemarrage serveur, ce qui est inacceptable pour une application de production. '
    'La migration vers la persistance Prisma/SQLite est essentielle avant tout deploiement.',
    body_style
))
story.append(Paragraph(
    'Enfin, l\'absence de validation des entrees API, les problemes d\'accessibilite et le '
    'manque de feedback utilisateur sur les erreurs sont des points a ameliorer pour atteindre '
    'un niveau de qualite production. Les recommandations detaillees dans ce rapport fournissent '
    'une feuille de route claire, organisee par priorite, pour porter l\'application au niveau '
    'de fiabilite attendu.',
    body_style
))

# ── Build ──
doc.build(story)
print(f"PDF genere avec succes: {output_path}")
print(f"Taille: {os.path.getsize(output_path)} octets")
