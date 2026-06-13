#!/usr/bin/env python3
"""HERMÈS — Analyse Concurrentielle & Recommandations Strategiques 2026"""

import sys, os, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm, mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether,
    CondPageBreak, HRFlowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import SimpleDocTemplate

# ── Fonts ──
pdfmetrics.registerFont(TTFont('SarasaMonoSC', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC-Bold', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSans', '/usr/share/fonts/truetype/chinese/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('SarasaMonoSC', normal='SarasaMonoSC', bold='SarasaMonoSC-Bold')
registerFontFamily('LiberationSans', normal='LiberationSans', bold='LiberationSans')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ── Palette ──
PAGE_BG       = colors.HexColor('#f4f5f5')
SECTION_BG    = colors.HexColor('#e8ebea')
CARD_BG       = colors.HexColor('#e4e7e6')
TABLE_STRIPE  = colors.HexColor('#f3f4f3')
HEADER_FILL   = colors.HexColor('#335644')
COVER_BLOCK   = colors.HexColor('#587c6a')
BORDER        = colors.HexColor('#c9d4ce')
ICON          = colors.HexColor('#3f9268')
ACCENT        = colors.HexColor('#228f22')
ACCENT_2      = colors.HexColor('#62c47b')
TEXT_PRIMARY   = colors.HexColor('#202321')
TEXT_MUTED     = colors.HexColor('#737d78')
SEM_SUCCESS   = colors.HexColor('#4c835e')
SEM_WARNING   = colors.HexColor('#a8894a')
SEM_ERROR     = colors.HexColor('#a35b55')
SEM_INFO      = colors.HexColor('#45698d')

# ── Styles ──
styles = getSampleStyleSheet()

body_style = ParagraphStyle(
    'Body', fontName='LiberationSans', fontSize=10.5, leading=17,
    alignment=TA_JUSTIFY, spaceAfter=8, firstLineIndent=0,
    textColor=TEXT_PRIMARY
)

h1_style = ParagraphStyle(
    'H1', fontName='LiberationSans', fontSize=20, leading=26,
    alignment=TA_LEFT, spaceBefore=18, spaceAfter=10,
    textColor=HEADER_FILL
)

h2_style = ParagraphStyle(
    'H2', fontName='LiberationSans', fontSize=15, leading=20,
    alignment=TA_LEFT, spaceBefore=14, spaceAfter=8,
    textColor=COVER_BLOCK
)

h3_style = ParagraphStyle(
    'H3', fontName='LiberationSans', fontSize=12, leading=16,
    alignment=TA_LEFT, spaceBefore=10, spaceAfter=6,
    textColor=ICON
)

callout_style = ParagraphStyle(
    'Callout', fontName='LiberationSans', fontSize=11, leading=17,
    alignment=TA_LEFT, spaceAfter=8, leftIndent=18,
    borderPadding=8, borderColor=ACCENT, borderWidth=0,
    textColor=ACCENT
)

caption_style = ParagraphStyle(
    'Caption', fontName='LiberationSans', fontSize=9, leading=12,
    alignment=TA_CENTER, spaceBefore=3, spaceAfter=6,
    textColor=TEXT_MUTED
)

header_cell_style = ParagraphStyle(
    'HeaderCell', fontName='LiberationSans', fontSize=10, leading=14,
    alignment=TA_CENTER, textColor=colors.white
)

cell_style = ParagraphStyle(
    'Cell', fontName='LiberationSans', fontSize=9.5, leading=13,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, wordWrap='CJK'
)

cell_center = ParagraphStyle(
    'CellCenter', fontName='LiberationSans', fontSize=9.5, leading=13,
    alignment=TA_CENTER, textColor=TEXT_PRIMARY
)

toc_h1 = ParagraphStyle('TOC1', fontName='LiberationSans', fontSize=13, leftIndent=20, leading=22, spaceBefore=6)
toc_h2 = ParagraphStyle('TOC2', fontName='LiberationSans', fontSize=11, leftIndent=40, leading=18)

# ── Helpers ──
available_width = A4[0] - 2 * 1.0 * inch  # ~451pt

class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

H1_ORPHAN = (A4[1] - 1.4*inch) * 0.15

def heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def major_section(text):
    return [CondPageBreak(H1_ORPHAN), heading(text, h1_style, level=0)]

def make_table(data, col_ratios, caption_text=None):
    col_widths = [r * available_width for r in col_ratios]
    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = colors.white if i % 2 == 1 else TABLE_STRIPE
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    elements = [Spacer(1, 18), t]
    if caption_text:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(caption_text, caption_style))
    elements.append(Spacer(1, 18))
    return elements

def callout_box(text):
    return [
        Spacer(1, 8),
        Table(
            [[Paragraph(text, callout_style)]],
            colWidths=[available_width * 0.92],
            hAlign='CENTER',
            style=TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#e8f5e9')),
                ('BOX', (0, 0), (-1, -1), 1.5, ACCENT),
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
                ('RIGHTPADDING', (0, 0), (-1, -1), 12),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ])
        ),
        Spacer(1, 8),
    ]

# ── Build Story ──
story = []

# TOC
toc = TableOfContents()
toc.levelStyles = [toc_h1, toc_h2]
story.append(Paragraph('<b>Table des matieres</b>', h1_style))
story.append(toc)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════
# SECTION 1: EXECUTIVE SUMMARY
# ═══════════════════════════════════════════════════════
story.extend(major_section('1. Resume executif'))
story.append(Paragraph(
    "HERMES est un dashboard d'acquisition B2B sur LinkedIn reposant sur 8 agents IA autonomes (Contenu, Qualification, Prospection, Engagement, Veille, Nurturing, Analyse, Reseau). L'application est construite en Next.js 16 avec un store Zustand, une integration OAuth 2.0 LinkedIn et un systeme de simulation d'agents. Malgre une ambition produit considerable et une interface soignee, l'application presente des lacunes significatives par rapport aux concurrents du marche de l'automation LinkedIn en 2026.",
    body_style
))
story.append(Paragraph(
    "Notre analyse identifie 6 lacunes critiques : l'absence d'orchestration inter-agents, l'absence de boucle de feedback, la dependance au contenu generique de l'IA, le silo entre contenu et prospection, l'absence de conformite proactive et le stockage de donnees volatile en localStorage. Ces lacunes placent HERMES en retrait par rapport a des concurrents comme Expandi ($99/mois), Salesflow ($99/mois), Dripify ($10/mois) et HeyReach ($59/mois), qui disposent de fonctionnalites d'automatisation matures, de sequences multi-canal et d'un CRM integre.",
    body_style
))
story.append(Paragraph(
    "Le rapport propose 5 recommandations strategiques priorisees, un plan d'evolution technique en 4 phases et une feuille de route sur 12 mois pour combler ces ecarts et positionner HERMES comme la reference en matiere d'agents IA d'acquisition B2B.",
    body_style
))

story.extend(callout_box(
    '<b>Constat principal :</b> HERMES a une vision produit ambitieuse et differenciante (agents IA), mais son execution technique reste au stade de prototype fonctionnel. Les concurrents directs proposent des fonctionnalites plus completes et eprouvees a des prix accessibles.'
))

# ═══════════════════════════════════════════════════════
# SECTION 2: ETAT DES LIEUX DU CODEBASE
# ═══════════════════════════════════════════════════════
story.extend(major_section('2. Etat des lieux du codebase'))

story.append(heading('2.1 Architecture generale', h2_style, level=1))
story.append(Paragraph(
    "Le codebase est structure autour d'une application Next.js 16 avec React 19, utilisant le App Router. L'etat global est gere par Zustand avec persistance localStorage (middleware persist). L'interface est construite avec shadcn/ui et Tailwind CSS 4. Le backend utilise des API Routes Next.js avec un systeme d'authentification OAuth 2.0 LinkedIn via cookies httpOnly. La base de donnees est SQLite via Prisma, bien que seuls les modeles User et Post y soient definis, sans reel usage operationnel.",
    body_style
))
story.append(Paragraph(
    "Le coeur du systeme repose sur le fichier appStore.ts (plus de 1200 lignes) qui centralise l'etat des 8 agents, les leads, l'ICP, la configuration des providers IA (10 providers supportes dont Groq, OpenRouter, Anthropic, OpenAI), les metriques et les journaux d'activite. Le fichier agent-runner.ts (plus de 1100 lignes) implemente la logique d'execution de chaque agent avec un mecanisme de fallback vers la simulation quand aucune cle API n'est configuree.",
    body_style
))

# Architecture table
arch_data = [
    [Paragraph('<b>Composant</b>', header_cell_style), Paragraph('<b>Technologie</b>', header_cell_style), Paragraph('<b>Role</b>', header_cell_style)],
    [Paragraph('Frontend', cell_style), Paragraph('Next.js 16, React 19, Tailwind 4', cell_style), Paragraph('Interface utilisateur et routage', cell_style)],
    [Paragraph('State Management', cell_style), Paragraph('Zustand + persist', cell_style), Paragraph('Etat global avec persistance localStorage', cell_style)],
    [Paragraph('UI Components', cell_style), Paragraph('shadcn/ui, Radix UI, Framer Motion', cell_style), Paragraph('Composants accessibles et animes', cell_style)],
    [Paragraph('Backend API', cell_style), Paragraph('Next.js API Routes', cell_style), Paragraph('Endpoints REST et OAuth 2.0', cell_style)],
    [Paragraph('AI Gateway', cell_style), Paragraph('10 providers (Groq, OpenRouter, etc.)', cell_style), Paragraph('Routage multi-provider unifie', cell_style)],
    [Paragraph('Database', cell_style), Paragraph('SQLite via Prisma', cell_style), Paragraph('Persiste User/Post (usage minimal)', cell_style)],
    [Paragraph('LinkedIn Integration', cell_style), Paragraph('OAuth 2.0 + LinkedIn API', cell_style), Paragraph('Publication, like, commentaire, feed', cell_style)],
]
story.extend(make_table(arch_data, [0.22, 0.38, 0.40], 'Tableau 1 : Stack technique HERMES'))

story.append(heading('2.2 Agents IA : etat actuel', h2_style, level=1))
story.append(Paragraph(
    "Chaque agent dispose d'un prompt systeme dedie dans agent-runner.ts avec une logique d'execution specifique. Les agents Contenu et Qualification utilisent le LLM pour generer du contenu et scorer les leads, tandis que les agents Engagement, Veille, Nurturing, Analyse et Reseau generent principalement du contenu simule en fallback. Le systeme de simulation (useAgentSimulation.ts) execute les agents en round-robin avec une frequence configurable (x1, x2, x4), mais ne dispose d'aucun veritable orchestrateur coordonnant les dependances entre agents.",
    body_style
))

agents_data = [
    [Paragraph('<b>Agent</b>', header_cell_style), Paragraph('<b>Fonction</b>', header_cell_style), Paragraph('<b>Execution reelle</b>', header_cell_style), Paragraph('<b>Fallback</b>', header_cell_style)],
    [Paragraph('01 - Contenu', cell_style), Paragraph('Generation de posts LinkedIn', cell_style), Paragraph('LLM (chatCompletion)', cell_center), Paragraph('Post simule', cell_center)],
    [Paragraph('02 - Qualification', cell_style), Paragraph('Scoring ICP des leads', cell_style), Paragraph('LLM + heuristique', cell_center), Paragraph('Score heuristique', cell_center)],
    [Paragraph('03 - Prospection', cell_style), Paragraph('Messages personnalises', cell_style), Paragraph('LLM', cell_center), Paragraph('DM simule', cell_center)],
    [Paragraph('04 - Engagement', cell_style), Paragraph('Commentaires sur posts ICP', cell_style), Paragraph('LLM', cell_center), Paragraph('Commentaire simule', cell_center)],
    [Paragraph('05 - Veille', cell_style), Paragraph('Briefings marche', cell_style), Paragraph('LLM (JSON)', cell_center), Paragraph('Briefing fige', cell_center)],
    [Paragraph('06 - Nurturing', cell_style), Paragraph('Suivi leads en attente', cell_style), Paragraph('LLM', cell_center), Paragraph('Action simulee', cell_center)],
    [Paragraph('07 - Analyse', cell_style), Paragraph('Recommandations perf.', cell_style), Paragraph('LLM (JSON)', cell_center), Paragraph('Insights fixes', cell_center)],
    [Paragraph('08 - Reseau', cell_style), Paragraph('Invitations strategiques', cell_style), Paragraph('LLM', cell_center), Paragraph('Note simulee', cell_center)],
]
story.extend(make_table(agents_data, [0.18, 0.30, 0.24, 0.28], 'Tableau 2 : Capacites des agents IA'))

story.append(heading('2.3 Integration LinkedIn', h2_style, level=1))
story.append(Paragraph(
    "L'integration LinkedIn est l'un des points forts du codebase avec un flux OAuth 2.0 complet (auth, callback, disconnect), la gestion des tokens via cookies httpOnly securises, la publication de posts (personnels et pages entreprise), le like et commentaire sur des posts, la consultation du feed, la planification de posts et l'optimisation IA du profil (scoring, suggestions). Cependant, l'API LinkedIn officielle impose des restrictions majeures : limite de 100 000 appels quotidiens, acces restreint au Member Data Platform (MDP), interdiction de scraper les donnees des membres, et scopes limits (openid, profile, email, w_member_social).",
    body_style
))
story.append(Paragraph(
    "Un point critique est le mode simulation du feed : l'API LinkedIn ne permettant pas d'acceder au feed reel d'un utilisateur, l'application genere un feed simule avec 6 posts types. Cette limitation est inherente a l'API LinkedIn et affecte tous les concurrents de la meme maniere, sauf ceux qui contournent les restrictions via des methodes non-officielles (navigateur headless, cookies de session).",
    body_style
))

# ═══════════════════════════════════════════════════════
# SECTION 3: ANALYSE CONCURRENTIELLE
# ═══════════════════════════════════════════════════════
story.extend(major_section('3. Analyse concurrentielle'))

story.append(heading('3.1 Paysage concurrentiel 2026', h2_style, level=1))
story.append(Paragraph(
    "Le marche de l'automation LinkedIn B2B en 2026 est extremement competitif avec plus de 40 outils references. Les prix s'echelonnent de 8,25 USD/mois (Linked Helper) a 1 499 USD/mois (HeyReach Unlimited). Le segment majoritaire se situe entre 50 et 150 USD/mois, avec une tendance marquee vers l'integration de fonctionnalites IA (AI SDR, personnalisation automatique, scoring predictif). Les principaux concurrents d'HERMES se repartissent en trois categories : les outils d'automation pure, les plateformes multi-canal et les solutions AI-native.",
    body_style
))

comp_data = [
    [Paragraph('<b>Outil</b>', header_cell_style), Paragraph('<b>Prix/mois</b>', header_cell_style), Paragraph('<b>Forces</b>', header_cell_style), Paragraph('<b>Faiblesses</b>', header_cell_style)],
    [Paragraph('Expandi', cell_style), Paragraph('$79-99', cell_center), Paragraph('Sequences safe, Smart Inbox, scraping profils', cell_style), Paragraph('Pas de contenu IA, CRM limite', cell_style)],
    [Paragraph('Salesflow', cell_style), Paragraph('$99', cell_center), Paragraph('Multi-comptes, hub CRM, tableaux leads', cell_style), Paragraph('UI datee, pas de veille marche', cell_style)],
    [Paragraph('Dripify', cell_style), Paragraph('$10-59', cell_center), Paragraph('Prix agressif, sequences drip, A/B test', cell_style), Paragraph('Fonctionnalites limitees, pas IA', cell_style)],
    [Paragraph('HeyReach', cell_style), Paragraph('$59-1499', cell_center), Paragraph('Scalable agences, warmup, analytics', cell_style), Paragraph('Cher, complexe pour solos', cell_style)],
    [Paragraph('Lemlist', cell_style), Paragraph('$59-99', cell_center), Paragraph('Multi-canal (email+LinkedIn), videos', cell_style), Paragraph('Email-first, LinkedIn secondaire', cell_style)],
    [Paragraph('Waalaxy', cell_style), Paragraph('$20-40', cell_center), Paragraph('Simple, onboarding rapide, pas cher', cell_style), Paragraph('Fonctionnalites basiques', cell_style)],
    [Paragraph('Botdog', cell_style), Paragraph('$30-70', cell_center), Paragraph('Pipeline visuel, rapport auto', cell_style), Paragraph('Pas de contenu IA autonome', cell_style)],
    [Paragraph('ConnectSafely', cell_style), Paragraph('$49-99', cell_center), Paragraph('API REST complete, contournement restrictions', cell_style), Paragraph('Technique, pas grand public', cell_style)],
]
story.extend(make_table(comp_data, [0.16, 0.12, 0.38, 0.34], 'Tableau 3 : Comparaison des concurrents directs'))

story.append(heading('3.2 Positionnement d\'HERMES', h2_style, level=1))
story.append(Paragraph(
    "HERMES se differencie par sa vision 'agents IA autonomes' : plutot que d'automatiser des taches unitaires (envoi de messages, sequences de connexion), il orchestre 8 agents specialises qui couvrent l'integralite du funnel d'acquisition B2B. Cette approche est unique sur le marche et correspond a la tendance 'Agentic AI' identifiee par Deloitte et Blue Prism pour 2026. Cependant, la differenciation est aujourd'hui theorique : les agents fonctionnent majoritairement en mode simulation, sans coordination reelle entre eux, et sans boucle de feedback qui permettrait au systeme d'apprendre de ses resultats.",
    body_style
))

gap_data = [
    [Paragraph('<b>Dimension</b>', header_cell_style), Paragraph('<b>Concurrents</b>', header_cell_style), Paragraph('<b>HERMES</b>', header_cell_style), Paragraph('<b>Ecart</b>', header_cell_style)],
    [Paragraph('Orchestration agents', cell_style), Paragraph('Workflows lineaires (trigger/action)', cell_style), Paragraph('8 agents independants', cell_style), Paragraph('Critique', cell_center)],
    [Paragraph('Sequences multi-canal', cell_style), Paragraph('Email + LinkedIn + tel', cell_style), Paragraph('LinkedIn uniquement', cell_style), Paragraph('Majeur', cell_center)],
    [Paragraph('CRM integre', cell_style), Paragraph('Pipeline, tags, filtres', cell_style), Paragraph('Table leads basique', cell_style), Paragraph('Majeur', cell_center)],
    [Paragraph('Contenu IA', cell_style), Paragraph('Templates + personnalisation', cell_style), Paragraph('Generation LLM (fallback sim.)', cell_style), Paragraph('Modere', cell_center)],
    [Paragraph('Compliance', cell_style), Paragraph('Warmup, limites auto, mimetisme', cell_style), Paragraph('Regles statiques', cell_style), Paragraph('Critique', cell_center)],
    [Paragraph('Data persistence', cell_style), Paragraph('Cloud DB, CRM sync', cell_style), Paragraph('localStorage (volatile)', cell_style), Paragraph('Critique', cell_center)],
    [Paragraph('Analytics', cell_style), Paragraph('Dashboards, A/B, ROI', cell_style), Paragraph('Metriques de base', cell_style), Paragraph('Majeur', cell_center)],
    [Paragraph('Pricing', cell_style), Paragraph('$10-1499/mois', cell_style), Paragraph('Gratuit (self-hosted)', cell_style), Paragraph('Avantage', cell_center)],
    [Paragraph('AI Agents', cell_style), Paragraph('AI SDR ($500+)', cell_style), Paragraph('8 agents specialises', cell_style), Paragraph('Avantage', cell_center)],
]
story.extend(make_table(gap_data, [0.20, 0.27, 0.30, 0.13], 'Tableau 4 : Matrice des ecarts HERMES vs Concurrents'))

# ═══════════════════════════════════════════════════════
# SECTION 4: DIAGNOSTIC TECHNIQUE
# ═══════════════════════════════════════════════════════
story.extend(major_section('4. Diagnostic technique detaille'))

story.append(heading('4.1 Absence d\'orchestration inter-agents', h2_style, level=1))
story.append(Paragraph(
    "Le probleme le plus structurel du codebase est l'absence d'orchestrateur central. Actuellement, useAgentSimulation.ts execute les agents en round-robin sans aucune dependance fonctionnelle : l'agent Contenu publie un post sans notifier l'agent Qualification, l'agent Qualification collecte des leads sans alerter l'agent Prospection, et l'agent Analyse genere des recommandations que personne ne consomme. Chaque agent est un ilot autonome qui ne communique pas avec les autres, ce qui annule le benefice theorique d'un systeme multi-agents.",
    body_style
))
story.append(Paragraph(
    "Les fichiers de configuration heartbeat (definis dans appStore.ts comme des chaines YAML) decrivent des triggers theoriques (on_post_published, on_linkedin_reply, on_no_reply:3d) mais ceux-ci ne sont jamais parses ni executes. Ils servent uniquement de documentation pour l'utilisateur, sans impact fonctionnel. Pour que le systeme devienne reellement 'agentique', il faudrait implementer un bus d'evenements permettant aux agents de s'envoyer des messages asynchrones et de reagir aux evenements du systeme.",
    body_style
))

story.append(heading('4.2 Absence de boucle de feedback', h2_style, level=1))
story.append(Paragraph(
    "Aucun agent ne dispose d'un mecanisme d'apprentissage base sur ses resultats. L'agent Contenu genere des posts sans jamais savoir combien d'impressions ou d'engagement ils ont genere. L'agent Prospection envoie des messages sans connaitre le taux de reponse reel. L'agent Analyse produit des recommandations mais ne mesure jamais si leur application ameliore les performances. En consequence, le systeme repete les memes patterns sans jamais s'ameliorer, ce qui est paradoxal pour un produit positionne sur l'IA.",
    body_style
))
story.append(Paragraph(
    "La comparaison avec les concurrents est edifiante : des outils comme Expandi et Lemlist proposent des tests A/B natifs sur les sequences de prospection, avec des algorithmes d'optimisation automatique qui selectionnent les variantes les plus performantes. Dripify offre un tableau de bord analytique detaille permettant d'identifier les messages et les sequences qui convertissent le mieux. HERMES ne dispose d'aucun de ces mecanismes, ce qui rend l'optimisation continue impossible.",
    body_style
))

story.append(heading('4.3 Stockage volatile (localStorage)', h2_style, level=1))
story.append(Paragraph(
    "L'utilisation de Zustand persist avec localStorage comme unique mecanisme de persistence est un risque majeur. Toutes les donnees (leads, configuration ICP, cles API, journaux d'activite, posts generes, metriques) sont stockees dans le navigateur de l'utilisateur. Cela signifie qu'un simple effacement du cache navigateur supprime l'integralite des donnees, qu'il n'y a aucune possibilite de collaboration multi-utilisateurs, et que les cles API des providers IA sont accessibles en clair dans le localStorage (vulnerabilite de securite).",
    body_style
))
story.append(Paragraph(
    "La base de donnees SQLite via Prisma existe dans le codebase (schema.prisma definit les modeles User et Post) mais n'est pas utilisee pour les donnees operationnelles. Les leads, les configurations et les metriques ne sont jamais ecrits en base, ce qui rend la migration vers un backend robuste d'autant plus complexe qu'il faudra restructurer la logique de persistence de maniere significative.",
    body_style
))

story.append(heading('4.4 Conformite LinkedIn insuffisante', h2_style, level=1))
story.append(Paragraph(
    "L'API LinkedIn impose des restrictions strictes : limite de 100 000 appels quotidiens, interdiction d'acceder aux donnees des membres sans MDP, restrictions sur le scraping, et limites d'invitation (100/semaine, 50/jour). HERMES ne dispose d'aucun mecanisme de conformite proactive : pas de compteur d'appels API, pas de warmup progressif des comptes, pas de limitation automatique du volume d'actions, pas de detection de risque de ban. Les concurrents comme Salesflow et Expandi integrent ces protections nativement, avec des systemes de mimetisme humain (delais aleatoires, variation des horaires, rotation des actions).",
    body_style
))

story.append(heading('4.5 Silo contenu-prospection', h2_style, level=1))
story.append(Paragraph(
    "L'agent Contenu genere des posts LinkedIn sans aucune boucle de retour vers les agents Qualification et Prospection. En theorie, un post qui genere de l'engagement devrait automatiquement declencher la collecte des interactions et la qualification des profils qui ont interagi. En pratique, ces agents fonctionnent de maniere totalement independante. Le contenu publie ne nourrit pas la prospection, et les leads qualifies n'influencent pas la strategie editoriale. Ce silo est d'autant plus dommageable qu'il constitue le coeur de la promesse produit d'HERMES.",
    body_style
))

# ═══════════════════════════════════════════════════════
# SECTION 5: RECOMMANDATIONS STRATEGIQUES
# ═══════════════════════════════════════════════════════
story.extend(major_section('5. Recommandations strategiques'))

story.append(heading('5.1 Implementer un orchestrateur d\'agents (PRIORITE CRITIQUE)', h2_style, level=1))
story.append(Paragraph(
    "L'orchestrateur est le composant manquant le plus critique. Il doit implementer un bus d'evenements (EventEmitter ou Redis Pub/Sub) permettant aux agents de communiquer de maniere asynchrone. Les triggers definis dans les fichiers heartbeat (on_post_published, on_linkedin_reply, on_no_reply:3d) doivent etre parses et executes reellement. L'orchestrateur doit gerer les dependances entre agents (l'agent Qualification ne peut pas scorer des leads avant que l'agent Contenu n'ait publie), les priorites d'execution et la gestion des conflits.",
    body_style
))
story.extend(callout_box(
    "<b>Architecture proposee :</b> Implementer un AgentOrchestrator base sur un event bus (EventEmitter cote client, WebSocket/Redis cote serveur). Chaque agent emet des evenements (agent.contenu.post_published, agent.qualif.leads_collected) et s&#39;abonne aux evenements des autres agents. Les heartbeats YAML sont parses en regles executables."
))

story.append(heading('5.2 Creer une boucle de feedback continue (PRIORITE HAUTE)', h2_style, level=1))
story.append(Paragraph(
    "Chaque agent doit mesurer l'impact de ses actions et ajuster son comportement en consequence. L'agent Contenu doit connaitre les impressions, le taux d'engagement et les commentaires de ses posts pour privilegier les formats et sujets qui performent le mieux. L'agent Prospection doit mesurer le taux de reponse par type de message et par secteur pour optimiser ses templates. L'agent Analyse doit non seulement produire des recommandations mais aussi verifier si les recommandations precedentes ont ete appliquees et si elles ont ameliore les resultats.",
    body_style
))
story.append(Paragraph(
    "Concretement, cela necessite la mise en place d'une table Metrics en base de donnees (pas localStorage) avec un historique des actions et de leurs resultats, un systeme de tags A/B pour les posts et messages (permettant de comparer les variantes), et un algorithme d'optimisation qui ajuste les parametres des agents en fonction des performances observees (par exemple, ajuster la temperature du LLM, modifier la longueur des messages, changer les horaires de publication).",
    body_style
))

story.append(heading('5.3 Migrer vers une persistance robuste (PRIORITE HAUTE)', h2_style, level=1))
story.append(Paragraph(
    "La migration de localStorage vers une base de donnees relationnelle (PostgreSQL via Prisma) est indispensable pour la fiabilite, la securite et la scalabilite du produit. Les cles API doivent etre chiffrees et stockees cote serveur, jamais exposees au client. Les leads, metriques et journaux d'activite doivent etre persistes en base pour permettre l'analyse historique et la collaboration multi-utilisateurs. Cette migration doit etre progressive : commencer par les donnees critiques (leads, metriques) puis etendre aux configurations et journaux.",
    body_style
))

story.append(heading('5.4 Ajouter la conformite LinkedIn proactive (PRIORITE HAUTE)', h2_style, level=1))
story.append(Paragraph(
    "HERMES doit integrer des mecanismes de protection conformement aux limites LinkedIn : compteur d'appels API avec alertes proches des seuils (80%, 90%, 95% du quota quotidien), warmup progressif des nouveaux comptes (augmentation graduelle du volume d'actions sur 14 jours), mimetisme humain (delais aleatoires entre les actions, variation des horaires de publication et d'envoi, rotation des templates pour eviter la detection de patterns), et detection de risque de ban (surveillance des signaux d'avertissement LinkedIn, mise en pause automatique en cas de suspicion).",
    body_style
))

story.append(heading('5.5 Etendre au multi-canal (PRIORITE MOYENNE)', h2_style, level=1))
story.append(Paragraph(
    "Pour rivaliser avec Lemlist et HeyReach, HERMES doit etendre ses canaux au-dela de LinkedIn : email (via SendGrid ou Resend), telephone (via Aircall ou RingCentral), et Twitter/X. L'architecture agent permet theoriquement cette extension : chaque canal serait un nouvel agent specialise (Agent Email, Agent Telephonie) qui s'integre a l'orchestrateur. La priorite est l'email, car c'est le canal le plus complementaire de LinkedIn dans une strategie B2B. L'implementation peut s'appuyer sur les memes patterns que l'agent LinkedIn (generation de contenu IA, sequences automatisees, suivi des reponses).",
    body_style
))

# ═══════════════════════════════════════════════════════
# SECTION 6: FEUILLE DE ROUTE
# ═══════════════════════════════════════════════════════
story.extend(major_section('6. Feuille de route technique'))

roadmap_data = [
    [Paragraph('<b>Phase</b>', header_cell_style), Paragraph('<b>Periode</b>', header_cell_style), Paragraph('<b>Objectifs</b>', header_cell_style), Paragraph('<b>Livrables</b>', header_cell_style)],
    [Paragraph('Phase 1 : Fondations', cell_style), Paragraph('Mois 1-3', cell_center),
     Paragraph('Orchestrateur, DB migration, conformite', cell_style),
     Paragraph('AgentOrchestrator, PostgreSQL, API tracker', cell_style)],
    [Paragraph('Phase 2 : Feedback', cell_style), Paragraph('Mois 4-6', cell_center),
     Paragraph('Boucle feedback, A/B testing, analytics', cell_style),
     Paragraph('Metrics DB, A/B engine, dashboard ROI', cell_style)],
    [Paragraph('Phase 3 : Multi-canal', cell_style), Paragraph('Mois 7-9', cell_center),
     Paragraph('Email, CRM integre, tableaux leads avance', cell_style),
     Paragraph('Agent Email, CRM views, pipeline avance', cell_style)],
    [Paragraph('Phase 4 : Scale', cell_style), Paragraph('Mois 10-12', cell_center),
     Paragraph('Multi-utilisateurs, agences, API publique', cell_style),
     Paragraph('Auth multi-user, workspace agences, API v1', cell_style)],
]
story.extend(make_table(roadmap_data, [0.18, 0.12, 0.35, 0.35], 'Tableau 5 : Feuille de route sur 12 mois'))

story.append(Paragraph(
    "La Phase 1 est la plus critique car elle pose les fondations techniques sans lesquelles les phases suivantes sont impossibles. L'orchestrateur doit etre implemente en premier, car il est le prealable a la boucle de feedback et a la coordination multi-canal. La migration PostgreSQL est egalement prioritaire car elle conditionne la persistence des metriques et la possibilite de multi-utilisateurs.",
    body_style
))

# KPIs
story.append(heading('6.1 KPIs de suivi', h2_style, level=1))
kpi_data = [
    [Paragraph('<b>KPI</b>', header_cell_style), Paragraph('<b>Cible Phase 1</b>', header_cell_style), Paragraph('<b>Cible Phase 4</b>', header_cell_style)],
    [Paragraph('Taux d\'execution reelle (vs simulation)', cell_style), Paragraph('40%', cell_center), Paragraph('85%', cell_center)],
    [Paragraph('Temps de reaction inter-agents', cell_style), Paragraph('< 5 min', cell_center), Paragraph('< 30 sec', cell_center)],
    [Paragraph('Couverture API LinkedIn', cell_style), Paragraph('60%', cell_center), Paragraph('95%', cell_center)],
    [Paragraph('Taux de conformite LinkedIn', cell_style), Paragraph('95%', cell_center), Paragraph('99.5%', cell_center)],
    [Paragraph('Retention donnees (vs localStorage)', cell_style), Paragraph('100% (PostgreSQL)', cell_center), Paragraph('100% + backup', cell_center)],
    [Paragraph('Canaux actifs', cell_style), Paragraph('1 (LinkedIn)', cell_center), Paragraph('3+ (LinkedIn, email, tel)', cell_center)],
]
story.extend(make_table(kpi_data, [0.40, 0.30, 0.30], 'Tableau 6 : KPIs de progression'))

# ═══════════════════════════════════════════════════════
# SECTION 7: CONCLUSION
# ═══════════════════════════════════════════════════════
story.extend(major_section('7. Synthese et priorisation'))

story.append(Paragraph(
    "HERMES dispose d'un positionnement produit differenciant sur un marche en pleine mutation vers l'Agentic AI. La vision des 8 agents specialises couvrant l'integralite du funnel d'acquisition B2B est unique et correspond aux tendances identifiees par Deloitte, Blue Prism et les analyses de marche pour 2026. Cependant, l'execution actuelle reste au stade de prototype fonctionnel avec des lacunes techniques qui limitent serieusement la valeur delivree aux utilisateurs.",
    body_style
))
story.append(Paragraph(
    "Les 5 recommandations priorisees dans ce rapport visent a combler methodiquement ces ecarts : l'orchestrateur d'agents (critique), la boucle de feedback (haute), la persistance robuste (haute), la conformite LinkedIn proactive (haute) et l'extension multi-canal (moyenne). La feuille de route sur 12 mois propose une progression en 4 phases qui respecte les dependances techniques et minimise les risques. En suivant cette trajectoire, HERMES peut evoluer d'un prototype ambitieux vers une plateforme de reference en matiere d'agents IA d'acquisition B2B.",
    body_style
))

prio_data = [
    [Paragraph('<b>Recommandation</b>', header_cell_style), Paragraph('<b>Priorite</b>', header_cell_style), Paragraph('<b>Impact</b>', header_cell_style), Paragraph('<b>Effort</b>', header_cell_style), Paragraph('<b>Phase</b>', header_cell_style)],
    [Paragraph('Orchestrateur d\'agents', cell_style), Paragraph('Critique', cell_center), Paragraph('Tres haut', cell_center), Paragraph('2-3 semaines', cell_center), Paragraph('1', cell_center)],
    [Paragraph('Boucle de feedback', cell_style), Paragraph('Haute', cell_center), Paragraph('Haut', cell_center), Paragraph('2 semaines', cell_center), Paragraph('2', cell_center)],
    [Paragraph('Persistance PostgreSQL', cell_style), Paragraph('Haute', cell_center), Paragraph('Haut', cell_center), Paragraph('1-2 semaines', cell_center), Paragraph('1', cell_center)],
    [Paragraph('Conformite LinkedIn', cell_style), Paragraph('Haute', cell_center), Paragraph('Haut', cell_center), Paragraph('1 semaine', cell_center), Paragraph('1', cell_center)],
    [Paragraph('Extension multi-canal', cell_style), Paragraph('Moyenne', cell_center), Paragraph('Moyen', cell_center), Paragraph('3-4 semaines', cell_center), Paragraph('3', cell_center)],
]
story.extend(make_table(prio_data, [0.28, 0.14, 0.16, 0.18, 0.10], 'Tableau 7 : Matrice de priorisation des recommandations'))

story.extend(callout_box(
    '<b>Message cle :</b> HERMES a un avantage strategique considerable avec sa vision agentique. Mais sans orchestrateur et sans boucle de feedback, les agents ne sont que des scripts independants. L\'enjeu n\'est pas d\'ajouter des fonctionnalites, mais de connecter les agents entre eux pour creer un systeme reellement intelligent.'
))

# ── Build ──
body_path = '/home/z/my-project/download/hermes-body-v2.pdf'
doc = TocDocTemplate(
    body_path,
    pagesize=A4,
    leftMargin=1.0*inch, rightMargin=1.0*inch,
    topMargin=0.8*inch, bottomMargin=0.8*inch,
)
doc.multiBuild(story)
print(f"Body PDF generated: {body_path}")
