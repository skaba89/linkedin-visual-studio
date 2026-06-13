#!/usr/bin/env python3
"""HERMES - Analyse Concurrentielle et Recommandations Strategiques 2026"""

import hashlib, os, subprocess
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, CondPageBreak, Image
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import SimpleDocTemplate

# ── Fonts ──
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Bold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))
registerFontFamily('Carlito', normal='Carlito', bold='Carlito-Bold')

# ── Palette (from cascade) ──
PAGE_BG       = colors.HexColor('#f4f4f3')
SECTION_BG    = colors.HexColor('#eae9e7')
CARD_BG       = colors.HexColor('#f0efed')
TABLE_STRIPE  = colors.HexColor('#f4f4f3')
HEADER_FILL   = colors.HexColor('#6f674f')
COVER_BLOCK   = colors.HexColor('#7a7258')
BORDER        = colors.HexColor('#bfbbae')
ICON          = colors.HexColor('#a18943')
ACCENT        = colors.HexColor('#5b32d4')
ACCENT_2      = colors.HexColor('#3db579')
TEXT_PRIMARY   = colors.HexColor('#171615')
TEXT_MUTED     = colors.HexColor('#7a7871')
SEM_SUCCESS   = colors.HexColor('#538b65')
SEM_WARNING   = colors.HexColor('#8d7544')
SEM_ERROR     = colors.HexColor('#a85b54')
SEM_INFO      = colors.HexColor('#44729f')

# ── Page ──
PAGE_W, PAGE_H = A4
LEFT_M = 1.0 * inch
RIGHT_M = 1.0 * inch
TOP_M = 0.85 * inch
BOT_M = 0.85 * inch
AVAIL_W = PAGE_W - LEFT_M - RIGHT_M

# ── Styles ──
body_style = ParagraphStyle(
    'Body', fontName='Carlito', fontSize=10.5, leading=17,
    alignment=TA_JUSTIFY, spaceAfter=6, textColor=TEXT_PRIMARY
)
h1_style = ParagraphStyle(
    'H1', fontName='Carlito-Bold', fontSize=20, leading=26,
    alignment=TA_LEFT, spaceBefore=18, spaceAfter=10, textColor=HEADER_FILL
)
h2_style = ParagraphStyle(
    'H2', fontName='Carlito-Bold', fontSize=15, leading=20,
    alignment=TA_LEFT, spaceBefore=14, spaceAfter=8, textColor=COVER_BLOCK
)
h3_style = ParagraphStyle(
    'H3', fontName='Carlito-Bold', fontSize=12, leading=17,
    alignment=TA_LEFT, spaceBefore=10, spaceAfter=6, textColor=ICON
)
bullet_style = ParagraphStyle(
    'Bullet', fontName='Carlito', fontSize=10.5, leading=17,
    alignment=TA_LEFT, spaceAfter=4, leftIndent=20, bulletIndent=8,
    textColor=TEXT_PRIMARY
)
muted_style = ParagraphStyle(
    'Muted', fontName='Carlito', fontSize=9, leading=13,
    alignment=TA_LEFT, textColor=TEXT_MUTED
)
header_cell_style = ParagraphStyle(
    'HeaderCell', fontName='Carlito-Bold', fontSize=10, leading=14,
    alignment=TA_CENTER, textColor=colors.white
)
cell_style = ParagraphStyle(
    'Cell', fontName='Carlito', fontSize=9.5, leading=14,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY
)
cell_center = ParagraphStyle(
    'CellCenter', fontName='Carlito', fontSize=9.5, leading=14,
    alignment=TA_CENTER, textColor=TEXT_PRIMARY
)
callout_style = ParagraphStyle(
    'Callout', fontName='Carlito', fontSize=11, leading=17,
    alignment=TA_LEFT, leftIndent=16, borderPadding=8,
    textColor=ACCENT, spaceBefore=6, spaceAfter=6
)
toc_h1_style = ParagraphStyle('TOCH1', fontName='Carlito', fontSize=13, leftIndent=20, leading=22)
toc_h2_style = ParagraphStyle('TOCH2', fontName='Carlito', fontSize=11, leftIndent=40, leading=18)

# ── Helpers ──
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def h1(text): return heading(text, h1_style, 0)
def h2(text): return heading(text, h2_style, 1)
def h3(text): return heading(text, h3_style, 2)

def body(text):
    return Paragraph(text, body_style)

def bullet(text):
    return Paragraph('<bullet>&bull;</bullet> ' + text, bullet_style)

def callout(text):
    return Paragraph('<b>' + text + '</b>', callout_style)

def make_table(headers, rows, col_ratios=None):
    n = len(headers)
    if col_ratios is None:
        col_ratios = [1.0/n] * n
    col_widths = [r * AVAIL_W for r in col_ratios]
    data = [[Paragraph('<b>%s</b>' % h, header_cell_style) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), cell_style) for c in row])
    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        bg = colors.white if i % 2 == 1 else TABLE_STRIPE
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

# ── Build Story ──
story = []

# TOC
toc = TableOfContents()
toc.levelStyles = [toc_h1_style, toc_h2_style]
story.append(Paragraph('<b>Table des matieres</b>', ParagraphStyle('TOCTitle', fontName='Carlito-Bold', fontSize=18, leading=24, alignment=TA_LEFT, textColor=HEADER_FILL, spaceAfter=12)))
story.append(toc)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════
# SECTION 1: ANALYSE CONCURRENTIELLE
# ═══════════════════════════════════════════════════════
story.append(h1('1. Analyse concurrentielle du marche 2026'))
story.append(body(
    "Le marche des outils d'automatisation LinkedIn et de prospection B2B connait une croissance rapide en 2026, porte par la democratisation de l'IA generative et l'explosion du social selling. Selon MarketsandMarkets, le marche des agents IA devrait passer de 7,84 milliards USD en 2025 a 52,62 milliards USD d'ici 2030, avec un TCAC de 46,3%. Plusieurs categories de concurrents se disputent le segment de la prospection LinkedIn, chacun avec des forces et des limites specifiques. Comprendre leurs positionnements respectifs est essentiel pour identifier les opportunites de differenciation strategique pour HERMES."
))

story.append(h2('1.1 Les principaux concurrents'))
story.append(body(
    "Le paysage concurrentiel se structure autour de trois categories d'acteurs : les outils d'automatisation LinkedIn pur, les plateformes de sales engagement multicanal, et les solutions d'IA generative pour la vente. Chacun couvre une partie du parcours de prospection, mais aucun ne propose une veritable orchestration multi-agents autonome. L'analyse qui suit repose sur les donnees de marche collectees en juin 2026, incluant les grilles tarifaires actualisees et les fonctionnalites les plus recentes de chaque plateforme."
))

story.append(make_table(
    ['Concurrent', 'Categorie', 'Forces', 'Limites', 'Tarif 2026'],
    [
        ['Waalaxy', 'Automatisation LinkedIn', 'Interface simple, campagnes automatisees, freemium 80 invits/mois', 'Pas d\'IA generative, pas de scoring ICP, mono-canal LinkedIn', '19-66 EUR/mois'],
        ['Lemlist', 'Sales engagement multicanal', 'Multicanal (email + LinkedIn), personalisation avancee, warm-up email', 'Focalise email, pas d\'agents autonomes, pas de veille strategique', '59-119 EUR/mois'],
        ['La Growth Machine', 'Multicanal LinkedIn + email + Twitter', 'Sequences multicanal, enrichment, Social Warming, Voice IA', 'Pas d\'IA strategique, pas de scoring dynamique, interface complexe', '60-165 EUR/mois'],
        ['Expandi', 'Automatisation LinkedIn avancee', 'Smart Sequences, branches conditionnelles, safety dashboard', 'Pas d\'IA, pas de contenu auto, interface technique, courbe d\'apprentissage', '49-99 EUR/mois'],
        ['Apollo.io', 'Base de donnees B2B + IA', '275M contacts, scoring IA, integration CRM, workflows', 'Pas d\'agents, pas de publication auto, pas de veille temps reel', '49-119 EUR/mois'],
        ['PhantomBuster', 'Scraping + automatisation', 'API puissantes, scraping en masse, multi-reseaux, flux automatises', 'Pas d\'IA, pas de contenu, technique a configurer, support lent', '56-224 EUR/mois'],
        ['Humanlinker', 'IA + prospection LinkedIn', 'Ultra-personnalisation IA, analyse DISC, scenarios de vente', 'Pas d\'agents, pas de publication, pas de veille, mono-utilisateur', '39-99 EUR/mois'],
        ['Amplemarket', 'Sales engagement IA', 'Multicanal, signal d\'achat, scoring avance, 219/231 features', 'Prix eleve, pas de publication contenu, pas de feed reel', '100+ EUR/mois'],
        ['Kanbox', 'Automatisation LinkedIn', 'Sequences longues, logique avancee, multi-comptes', 'Nouveau sur le marche, moins de integrations, communauté réduite', '49-99 EUR/mois'],
    ],
    col_ratios=[0.10, 0.12, 0.26, 0.30, 0.12]
))
story.append(Spacer(1, 12))

story.append(h2('1.2 Positionnement tarifaire du marche'))
story.append(body(
    "L'analyse des grilles tarifaires 2026 revele une segmentation claire du marche en trois ranges de prix. L'entree de gamme (19-50 EUR/mois) est dominee par Waalaxy et ses concurrents directs qui proposent des fonctionnalites d'automatisation basique. Le milieu de gamme (50-100 EUR/mois) regroupe les plateformes multicanal comme Lemlist, Expandi et Apollo. Le haut de gamme (100+ EUR/mois) est occupe par les solutions enterprise comme Amplemarket et La Growth Machine dans sa version Ultimate. Cette structure tarifaire laisse une opportunite pour HERMES de se positionner de maniere competitive en proposant un rapport fonctionnalites/prix superieur grace a son architecture multi-agents qui elimine le besoin de souscrire a plusieurs outils separes."
))

story.append(make_table(
    ['Range de prix', 'Concurrents', 'Fonctionnalites couvertes', 'Ce qui manque'],
    [
        ['Entree de gamme (19-50 EUR)', 'Waalaxy, Dripify, Kaspr', 'Automatisation basique, invitations, messages', 'IA, scoring, contenu, veille, CRM'],
        ['Milieu de gamme (50-100 EUR)', 'Expandi, Apollo, Humanlinker, PhantomBuster', 'Scoring, scraping, personnalisation IA, sequences', 'Publication auto, agents, veille, compliance'],
        ['Haut de gamme (100+ EUR)', 'LGM Ultimate, Amplemarket, Lemlist Business', 'Multicanal avance, integrations CRM, signals', 'Agents autonomes, contenu auto, orchestration'],
    ],
    col_ratios=[0.20, 0.20, 0.30, 0.30]
))
story.append(Spacer(1, 12))

story.append(h2('1.3 Lacunes identifiees chez les concurrents'))
story.append(body(
    "L'analyse approfondie de ces solutions revele six lacunes majeures que personne ne comble actuellement de maniere integree. Ces lacunes representent autant d'opportunites strategiques pour HERMES, car elles correspondent a des besoins reels et non satisfaits des equipes commerciales B2B. Chaque lacune est illustree par des donnees concretes issues de l'analyse des fonctionnalites des concurrents et des retours utilisateurs sur les plateformes comme Reddit et les forums specialises."
))
story.append(bullet("<b>Absence d'orchestration intelligente</b> : Les concurrents proposent des sequences lineaires (si A alors B), mais aucun ne propose un veritable systeme multi-agents ou chaque agent est specialise et collabore avec les autres de facon autonome. Les sequences restent rigides et ne s'adaptent pas en temps reel au comportement du prospect. L'Agent Analyse d'HERMES genere des recommandations mais celles-ci ne sont jamais appliquees automatiquement aux autres agents."))
story.append(bullet("<b>Pas de boucle de retroaction</b> : Les outils actuels n'apprennent pas de leurs resultats. Si un type de message ne genere pas de reponses, l'outil continue a l'envoyer. Il n'existe pas de mecanisme d'auto-optimisation base sur les metriques reelles d'engagement. L'Agent Analyse produit des insights mais le systeme ne les utilise pas pour ajuster le comportement des autres agents en boucle fermee."))
story.append(bullet("<b>Contenu IA generique</b> : Meme les outils integres a l'IA (Humanlinker, Apollo) generent du contenu de maniere isolee, sans prendre en compte le contexte strategique global de l'entreprise, son ICP, ses posts recents, les tendances du marche. L'Agent Contenu d'HERMES selectionne des sujets parmi une liste predefinie au lieu d'exploiter les insights de l'Agent Veille."))
story.append(bullet("<b>Silo entre publication et prospection</b> : Les outils se divisent en deux camps : ceux qui publient (Buffer, Hootsuite) et ceux qui prospectent (Waalaxy, Expandi). Aucun ne relie les deux de maniere fluide, alors que le contenu publie alimente directement la prospection. L'Agent Prospection ne reference pas les posts publies par l'Agent Contenu dans ses DMs."))
story.append(bullet("<b>Pas de conformite proactive</b> : Les limites LinkedIn sont gerees manuellement ou via des securites basiques. Aucun outil ne propose une conformite intelligente qui ajuste le rythme d'activite en fonction des signaux de risque en temps reel. HERMES ne possede pas de dashboard de sante du compte LinkedIn."))
story.append(bullet("<b>Donnees en memoire volatile</b> : Toutes les donnees d'HERMES sont stockees dans le localStorage du navigateur via Zustand. Les posts planifies, les leads, les messages generes et les metriques sont perdus si l'utilisateur efface ses donnees de navigation. Aucun concurrent de cette envergure ne fonctionne sans base de donnees persistante cote serveur."))

story.append(h2('1.4 Contraintes de l\'API LinkedIn'))
story.append(body(
    "Un facteur externe majeur influence le positionnement concurrentiel : l'acces a l'API LinkedIn. Depuis 2015, l'API LinkedIn n'est plus publiquement accessible. L'acces au Marketing Developer Platform est reserve aux partenaires enterprise, avec un processus d'approbation qui peut prendre plusieurs mois. Les limites d'appels sont de 100 000 appels par jour pour les partenaires approuves, et les cas d'usage restrictifs interdisent explicitement le scraping de donnees de membres et l'automatisation d'actions de prospection. Cette realite technique oblige tous les concurrents a contourner les limitations officielles, soit via des solutions de scraping tiers (Apify, PhantomBuster), soit via l'automatisation de navigateur (Playwright, Selenium), soit via des APIs non officielles (Unipile). HERMES doit integrer cette contrainte dans sa strategie technique pour proposer une solution a la fois efficace et durable."
))

# ═══════════════════════════════════════════════════════
# SECTION 2: DIAGNOSTIC DU CODEBASE HERMES
# ═══════════════════════════════════════════════════════
story.append(Spacer(1, 8))
story.append(h1('2. Diagnostic technique du codebase HERMES'))
story.append(body(
    "L'analyse detaillee du code source d'HERMES revele une architecture solide sur le plan conceptuel mais presentant plusieurs faiblesses techniques critiques qui empechent le produit de passer du stade de prototype fonctionnel a celui d'outil de production fiable. Ce diagnostic identifie les problemes concrets dans le code actuel et quantifie leur impact sur l'experience utilisateur et la fiabilite du systeme."
))

story.append(h2('2.1 Probleme critique : persistance des donnees'))
story.append(body(
    "Le probleme le plus critique du codebase actuel est l'absence totale de persistance cote serveur. L'integralite de l'etat de l'application est stockee dans le Zustand store avec le middleware persist, qui utilise le localStorage du navigateur. Cela signifie que les posts planifies, les leads qualifies, les messages generes, les metriques d'engagement, et l'historique des actions de chaque agent sont tous perdus si l'utilisateur efface ses donnees de navigation, change de navigateur, ou utilise un autre appareil. Le schema Prisma existe mais ne contient que les modeles User et Post, tandis que les 15+ types de donnees de l'application (ScheduledPost, Lead, GeneratedMessage, etc.) ne sont pas persistes en base de donnees."
))

story.append(make_table(
    ['Donnee', 'Stockage actuel', 'Risque', 'Impact'],
    [
        ['Posts planifies', 'Zustand/localStorage', 'Perte au redemarrage navigateur', 'CRITIQUE : posts jamais publies'],
        ['Leads et scoring ICP', 'Zustand/localStorage', 'Perte au changement d\'appareil', 'CRITIQUE : pipeline perdu'],
        ['Messages generes', 'Zustand/localStorage', 'Pas d\'historique cote serveur', 'ELEVE : pas de suivi'],
        ['Metriques d\'engagement', 'Zustand/localStorage', 'Pas d\'historisation', 'ELEVE : pas d\'analyse de tendances'],
        ['Cles API providers', 'Zustand/localStorage', 'Exposition cote client', 'SECURITE : cles visibles'],
        ['Config ICP', 'Zustand/localStorage', 'Pas de synchronisation', 'MOYEN : config par appareil'],
    ],
    col_ratios=[0.18, 0.18, 0.28, 0.36]
))
story.append(Spacer(1, 12))

story.append(h2('2.2 Probleme critique : agents en mode simulation'))
story.append(body(
    "Le deuxieme probleme majeur est que l'integralite du systeme d'agents fonctionne en mode simulation par defaut. Lorsqu'aucune cle API n'est configuree, chaque agent genere du contenu predetermine a partir de listes statiques hardcoded dans le code. L'Agent Contenu selectionne des sujets parmi POST_TOPICS (10 sujets fixes), l'Agent Qualification utilise LEAD_PROFILES (8 profils fixes), l'Agent Engagement utilise ICP_FEED_POSTS (6 posts fixes), et l'Agent Reseau utilise NETWORK_PROSPECTS (6 prospects fixes). Ce mode simulation est necessaire pour la demonstration, mais le passage au mode reel avec cle API ne transforme pas fondamentalement le comportement : les agents executent des taches unitaires sans coordination, sans memoire des resultats precedents, et sans boucle de retroaction."
))

story.append(h2('2.3 Probleme structurel : absence de coordination inter-agents'))
story.append(body(
    "Le agent-runner.ts implemente 8 fonctions d'execution independantes (runContenuAgent, runQualificationAgent, etc.) qui ne communiquent pas entre elles. Chaque agent lit l'etat global via useAppStore.getState() mais ne peut pas influencer le comportement des autres agents. L'Agent Veille genere un briefing marche mais l'Agent Contenu ne l'utilise pas pour choisir ses sujets. L'Agent Analyse produit des recommandations mais l'Agent Prospection ne les integre pas dans ses messages. L'Agent Contenu publie un post mais ne declenche pas automatiquement l'Agent Qualification pour collecter les interactions. Cette absence de communication inter-agents est le probleme architectural le plus fondamental d'HERMES, car elle annule l'avantage concurrentiel principal du systeme multi-agents."
))

story.append(h2('2.4 Probleme de securite : cles API cote client'))
story.append(body(
    "Les cles API des 10 fournisseurs LLM sont stockees dans hermesConfig.providerApiKeys dans le Zustand store, ce qui signifie qu'elles sont persistees en clair dans le localStorage du navigateur. Le endpoint /api/ai/chat recoit la cle API via un header x-api-key et la transmet directement au fournisseur. Ce schema est fonctionnel mais presente un risque de securite : toute extension de navigateur ou script malveillant peut acceder aux cles API via localStorage. Pour un outil de production B2B, les cles API doivent etre stockees cote serveur, chiffrees en base de donnees, et jamais exposees au client. Le endpoint /api/ai/chat doit recuperer la cle API cote serveur plutot que de la recevoir du client."
))

story.append(h2('2.5 Problemes operationnels'))
story.append(body(
    "Plusieurs problemes operationnels affectent la fiabilite du systeme en conditions reelles. Le scheduler de posts repose sur un setInterval cote serveur qui verifie les posts planifies toutes les 30 secondes, sans mecanisme de retry en cas d'echec. Le feed LinkedIn est simule avec 6 posts predefinis car l'acces au vrai feed via l'API officielle est restreint aux partenaires Marketing Developer Platform. L'interface utilise un routing cote client via un switch/case dans page.tsx, ce qui empeche le partage d'URL vers des vues specifiques et complique le referencement. Enfin, l'absence de tests automatises rend chaque modification risquee pour la stabilite du systeme."
))

# ═══════════════════════════════════════════════════════
# SECTION 3: RECOMMANDATIONS STRATEGIQUES
# ═══════════════════════════════════════════════════════
story.append(Spacer(1, 8))
story.append(h1('3. Recommandations strategiques'))
story.append(body(
    "Sur la base de l'analyse concurrentielle et du diagnostic technique, voici les recommandations strategiques prioritaires pour transformer HERMES d'un prototype fonctionnel en une plateforme d'acquisition B2B autonome et leader sur son segment. Chaque recommandation est assortie d'une estimation d'effort, d'un impact concurrentiel, et de dependances techniques."
))

story.append(h2('3.1 Devenir la premiere plateforme multi-agents orchestree'))
story.append(body(
    "Le concept de multi-agents est l'avantage concurrentiel le plus puissant d'HERMES, mais il est actuellement sous-exploite. Les agents fonctionnent de maniere sequentielle et independante, sans veritable coordination intelligente. Pour se differencier radicalement, HERMES doit evoluer vers un systeme ou les agents communiquent, s'adaptent et prennent des decisions collaboratives en temps reel. Cela signifie qu'un signal detecte par l'Agent Veille (par exemple, une tendance emergente sur l'IA agentique) declenche automatiquement l'Agent Contenu pour creer un post, qui lui-meme alimente l'Agent Qualification pour identifier les prospects interesses par ce sujet, qui active l'Agent Prospection avec un message personnalise faisant reference a cette tendance."
))
story.append(bullet("<b>Orchestrateur central (Agent 00)</b> : Creer un Agent Orchestrateur qui supervise les 8 agents, detecte les opportunites cross-agents, et dispatche les taches en temps reel plutot que de suivre un planning fixe. L'orchestrateur analyse les evenements du systeme et determine quel agent doit etre active, avec quelles donnees, et dans quel ordre. Il peut aussi suspendre un agent si l'Agent Analyse detecte une baisse de performance."))
story.append(bullet("<b>Bus d'evenements</b> : Implementer un systeme de messagerie asynchrone entre agents pour remplacer les plannings rigides par des declenchements evenementiels. Quand l'Agent Contenu publie un post, un evenement post_published est emis, et l'Agent Qualification s'inscrit a cet evenement pour declencher automatiquement la collecte d'interactions apres un delai de 2 heures."))
story.append(bullet("<b>Memoire partagee</b> : Chaque agent doit pouvoir acceder aux resultats des autres agents en temps reel. L'Agent Prospection doit savoir quels sujets sont tendance via l'Agent Veille, quels posts ont performe via l'Agent Contenu, et quels leads sont chauds via l'Agent Qualification. Cette memoire partagee remplace les listes statiques actuelles par des donnees dynamiques et contextuelles."))

story.append(make_table(
    ['Composant', 'Implementation', 'Effort', 'Impact concurrentiel'],
    [
        ['Agent Orchestrateur', 'Nouveau module TypeScript avec logique de routing evenementiel', '3-4 semaines', 'TRES ELEVE : differentiateur unique'],
        ['Bus d\'evenements', 'EventEmitter interne ou Redis Pub/Sub pour la production', '1-2 semaines', 'ELEVE : active la coordination'],
        ['Memoire partagee', 'Table Prisma AgentMemory + API de lecture pour chaque agent', '2 semaines', 'ELEVE : remplace les listes statiques'],
    ],
    col_ratios=[0.18, 0.32, 0.15, 0.35]
))
story.append(Spacer(1, 12))

story.append(h2('3.2 Implementer l\'auto-apprentissage et l\'optimisation continue'))
story.append(body(
    "Aujourd'hui, l'Agent Analyse produit des recommandations mais celles-ci ne sont jamais appliquees automatiquement. HERMES doit fermer la boucle de retroaction : mesurer les resultats de chaque action, identifier ce qui fonctionne, et ajuster les strategies en consequence. C'est la difference entre un outil qui execute et un systeme qui apprend. Les concurrents comme Amplemarket commencent a integrer du machine learning pour le scoring, mais aucun ne propose une boucle de retroaction complete qui couvre l'ensemble du parcours d'acquisition."
))
story.append(bullet("<b>A/B testing automatise</b> : L'Agent Contenu genere automatiquement 2 variantes d'un meme post (hook different, ton different, format different), publie la variante A le lundi et la variante B le mardi, mesure l'engagement, et ajuste les generations futures en consequence. Le systeme maintient un historique des performances par type de hook, par format, et par sujet."))
story.append(bullet("<b>Scoring dynamique de l'ICP</b> : L'ICP ne doit plus etre statique. Si les leads avec le titre Head of Growth convertissent a 35% mais les CMO seulement a 12%, le scoring doit s'ajuster automatiquement en ponderant le critere titre differemment. Le barème actuel (titre +30, secteur +20, etc.) doit evoluer vers un modele ou les poids sont apprises automatiquement."))
story.append(bullet("<b>Optimisation des creneaux</b> : Au lieu de se baser sur des donnees generales (les creneaux B2B optimaux), HERMES doit analyser les propres donnees de l'utilisateur : quand ses posts obtiennent le plus d'engagement, quand ses DMs ont le meilleur taux de reponse, et adapter les plannings en consequence."))

story.append(h2('3.3 Creer la boucle contenu-prospection unifiee'))
story.append(body(
    "C'est le facteur de differenciation le plus impactant a court terme. Aucun concurrent ne relie actuellement la creation de contenu a la prospection de maniere intelligente. HERMES est le seul outil qui possede a la fois un Agent Contenu et un Agent Prospection dans la meme plateforme. Il faut exploiter cette unicite en creant un lien explicite entre les posts publies et les messages de prospection envoyes. Quand l'Agent Prospection genere un DM, il doit automatiquement faire reference au dernier post publie par l'utilisateur : ce contexte rend le message 3x plus pertinent qu'un cold DM generique. Inversement, quand un prospect repond positivement a un DM, l'Agent Contenu doit generer un post sur le sujet qui a attire ce prospect pour reproduire le meme effet d'attraction."
))
story.append(bullet("<b>Prospection contextuelle</b> : Chaque DM genere par l'Agent Prospection doit inclure une reference au dernier post publie, au briefing marche le plus recent, ou a la tendance identifiee par l'Agent Veille. Ce contexte transforme un cold DM en conversation naturelle."))
story.append(bullet("<b>Alimentation inverse</b> : Quand un prospect repond positivement a un DM, l'Agent Contenu doit generer un post sur le sujet qui a attire ce prospect, pour reproduire le meme effet d'attraction a plus grande echelle."))
story.append(bullet("<b>Signaux d'achat en temps reel</b> : Si un prospect like 3 posts consecutifs sur le meme sujet, c'est un signal d'achat fort. HERMES doit detecter ces sequences comportementales et alerter l'Agent Prospection en priorite haute."))

story.append(h2('3.4 Renforcer la conformite et la securite LinkedIn'))
story.append(body(
    "Le risque numero un pour tout utilisateur d'outils d'automatisation LinkedIn est le bannissement de son compte. Les concurrents gerent ce risque de maniere reactive (limites journalieres fixes). HERMES peut se differencier avec une approche proactive et intelligente de la conformite, qui s'adapte en temps reel aux signaux de risque. Selon les discussions sur Reddit et les forums specialises, le bannissement est la preoccupation principale des utilisateurs d'outils comme Expandi et Dripify. Un moteur de compliance intelligent qui reduit le risque de bannissement serait un argument de vente majeur."
))
story.append(bullet("<b>Compliance engine intelligent</b> : Au lieu de limites fixes (80 invitations/jour), implementer un moteur qui ajuste dynamiquement les limites en fonction de l'age du compte, du taux d'acceptation recent, du volume d'activite des 7 derniers jours, et des signaux d'avertissement LinkedIn (CAPTCHA, restriction temporaire). Ce moteur calcule un score de sante du compte en temps reel et ralentit automatiquement l'activite si le score baisse."))
story.append(bullet("<b>Mode ghost</b> : Un mode qui simule le comportement humain avec des pauses aleatoires, des vitesses de frappe variables, des sessions de navigation organiques entre les actions d'automatisation. Ce mode est particulierement important pour les actions de l'Agent Engagement et l'Agent Reseau, qui sont les plus risquees en termes de detection."))
story.append(bullet("<b>Dashboard de sante du compte</b> : Un indicateur en temps reel du score de sante LinkedIn, avec des alertes precoces quand le comportement est suspect, et des recommandations de reduction d'activite. Ce dashboard doit etre visible en permanence dans l'interface, pas enterre dans les parametres."))

# ═══════════════════════════════════════════════════════
# SECTION 4: EVOLUTIONS TECHNIQUES PRIORITAIRES
# ═══════════════════════════════════════════════════════
story.append(Spacer(1, 8))
story.append(h1('4. Evolutions techniques prioritaires'))
story.append(body(
    "Au-dela de la strategie, des evolutions techniques concretes sont necessaires pour transformer HERMES en plateforme de reference. Voici les implementations prioritaires classees par impact et complexite, avec des specifications techniques suffisamment detaillees pour guider le developpement."
))

story.append(h2('4.1 Persistance des donnees et base de donnees'))
story.append(body(
    "Actuellement, les posts planifies, les leads, les messages generes et les metriques sont stockes en memoire volatile via Zustand/localStorage. C'est un probleme critique pour un outil de production. La migration vers une base de donnees persistante est la priorite technique numero un. Prisma et SQLite sont deja configures dans le projet, il faut etendre le schema pour couvrir tous les modeles de donnees et migrer les operations CRUD cote serveur."
))
story.append(bullet("<b>Extension du schema Prisma</b> : Ajouter les modeles ScheduledPost, GeneratedPost, Lead, GeneratedMessage, GeneratedComment, MarketBriefing, NurturingAction, PerformanceInsight, ConnectionRequest, ActivityLog, AgentMemory, ICPConfig, HermesConfig. Chaque modele doit inclure un userId pour le multi-utilisateur futur."))
story.append(bullet("<b>API REST pour chaque modele</b> : Creer des endpoints API Next.js pour les operations CRUD sur chaque modele. L'interface utilise ces endpoints au lieu de manipuler directement le Zustand store. Le store devient un cache cote client synchronise avec le serveur."))
story.append(bullet("<b>Migration des cles API cote serveur</b> : Les cles API doivent etre stockees en base de donnees, chiffrees avec AES-256, et accessibles uniquement via les endpoints API. Le endpoint /api/ai/chat recupere la cle cote serveur au lieu de la recevoir du client."))
story.append(bullet("<b>Historisation des metriques</b> : Creer une table DailyMetrics avec un enregistrement par jour par utilisateur, stockant les metriques d'engagement, les volumes de prospection, et les taux de conversion. Sans cet historique, l'auto-apprentissage et l'analyse de tendances sont impossibles."))

story.append(h2('4.2 Vrai feed LinkedIn via scraping'))
story.append(body(
    "Le feed LinkedIn actuel est simule avec 6 posts predefinis (ICP_FEED_POSTS dans agent-runner.ts). L'acces au vrai feed est indispensable pour que l'Agent Engagement et l'Agent Commenter puissent fonctionner reellement. L'API LinkedIn Marketing Developer Platform est reservee aux partenaires enterprise, mais des alternatives techniques existent pour recuperer le feed reel."
))
story.append(bullet("<b>Integration Apify/PhantomBuster</b> : Utiliser les scrapers Apify ou PhantomBuster comme source de donnees pour le feed LinkedIn. Ces services contournent les limitations de l'API officielle et fournissent des donnees structurees en temps reel via des API REST. L'integration est rapide (1-2 semaines) mais ajoute une dependance tierce et un cout mensuel supplementaire."))
story.append(bullet("<b>Scraping navigateur via Playwright</b> : Implementer un module de scraping cote serveur avec Playwright pour extraire le feed directement depuis la session LinkedIn de l'utilisateur. Plus complexe (3-4 semaines) mais independant de services tiers. Requiert une gestion rigoureuse des sessions et des cookies."))
story.append(bullet("<b>Integration Unipile</b> : Unipile propose une API non officielle qui encapsule les appels LinkedIn via une SDK. C'est l'approche la plus equilibree : moins risqueuse que le scraping direct, moins couteuse qu'Apify, et avec une bonne couverture fonctionnelle (feed, messages, profil, invitations)."))

story.append(h2('4.3 API webhooks et integrations tierces'))
story.append(body(
    "HERMES fonctionne actuellement en silo. Pour devenir un hub d'acquisition B2B, il doit s'integrer avec l'ecosysteme existant de l'utilisateur : CRM, calendrier, outils d'email, plateformes d'analytics. Les webhooks sont le mecanisme le plus flexible pour ces integrations, car ils permettent a HERMES de notifier les systemes externes en temps reel quand un evenement important se produit, et inversement de recevoir des notifications d'autres systemes."
))
story.append(bullet("<b>Integration HubSpot/Pipedrive</b> : Synchroniser les leads qualifies et les statuts de prospection bidirectionnellement avec le CRM de l'utilisateur. Quand un lead passe booked dans HERMES, il est automatiquement cree comme deal dans le CRM. Quand un deal est ferme dans le CRM, HERMES met a jour le statut du lead et desactive les sequences de prospection."))
story.append(bullet("<b>Integration Calendly/Cal.com</b> : Inclure automatiquement le lien de reservation dans les DMs de prospection quand le lead est chaud, et tracker les RDV pris via les webhooks Calendly. L'objectif est de mesurer le taux de conversion DM vers RDV, qui est la metrique la plus importante pour valider l'efficacite du systeme."))
story.append(bullet("<b>Notifications Slack/Discord</b> : Envoyer des alertes en temps reel quand un lead cible repond, quand un post depasse un seuil d'engagement, ou quand l'Agent Analyse detecte une anomalie. Ces notifications sont deja prevues dans les heartbeatMd des agents mais ne sont pas implementees."))

story.append(h2('4.4 Scheduling robuste avec cron jobs'))
story.append(body(
    "Le systeme de planification actuel repose sur un setInterval cote serveur qui verifie les posts planifies toutes les 30 secondes. Ce n'est pas fiable : les posts sont perdus au redemarrage, il n'y a pas de mecanisme de retry, et la precision est mediocre. Un systeme de cron jobs robuste est indispensable pour un outil de production, car la fiabilite de la publication est directement liee a la confiance de l'utilisateur dans le systeme."
))
story.append(bullet("<b>node-cron ou BullMQ</b> : Utiliser BullMQ avec Redis pour une file de taches persistante avec retry automatique, delays, et priorites. Chaque post planifie devient un job dans la file, avec un ID de traceabilite, une date d'execution, et un statut. Si la publication echoue, le job est reessaie automatiquement avec un backoff exponentiel."))
story.append(bullet("<b>Timezone-aware scheduling</b> : Permettre a l'utilisateur de specifier son fuseau horaire et planifier les posts en consequence. Un post planifie a 8h00 doit etre publie a 8h00 dans le fuseau de l'utilisateur, pas du serveur. Cela requiert de stocker le timezone de l'utilisateur en base de donnees et de convertir les heures au moment de l'execution."))
story.append(bullet("<b>Monitoring des jobs</b> : Un dashboard de monitoring des taches planifiees avec statut (en attente, en cours, publie, echoue), logs d'execution, et possibilite de replanifier manuellement. Ce dashboard est essentiel pour la confiance de l'utilisateur."))

# ═══════════════════════════════════════════════════════
# SECTION 5: EVOLUTIONS FONCTIONNELLES
# ═══════════════════════════════════════════════════════
story.append(Spacer(1, 8))
story.append(h1('5. Evolutions fonctionnelles a fort impact'))
story.append(body(
    "Au-dela des evolutions techniques, des fonctionnalites nouvelles peuvent transformer l'experience utilisateur et creer des barrieres a l'entree significatives contre la concurrence. Ces evolutions fonctionnelles sont classees par impact concurrentiel et faisabilite technique."
))

story.append(h2('5.1 Intelligence de contenu contextuelle'))
story.append(body(
    "L'Agent Contenu genere actuellement des posts a partir de sujets predefinis (POST_TOPICS dans agent-runner.ts contient 10 sujets fixes) ou de suggestions IA generiques. Pour creer un avantage competitif durable, l'Agent doit acceder a des sources d'information en temps reel pour produire du contenu unique, credible et impossible a reproduire par un concurrent. La veille web en temps reel est la cle de cette evolution, car elle permet a l'Agent Contenu de citer des sources recentes, de reagir a l'actualite du secteur, et de proposer des angles originaux que les concurrents ne peuvent pas generer."
))
story.append(bullet("<b>Veille web en temps reel</b> : L'Agent Veille utilise la recherche web pour scraper les actualites IA/B2B du jour, identifie les angles non couverts, et alimente l'Agent Contenu avec des sujets frais et des donnees verifiees. Chaque post peut citer une source recente, ce qui credibilite le contenu et attire l'engagement."))
story.append(bullet("<b>Analyse des posts viraux</b> : Identifier les posts LinkedIn qui generent le plus d'engagement dans la niche de l'utilisateur, analyser leur structure (hook, format, longueur, CTA), et reproduire les patterns qui fonctionnent. L'Agent Contenu doit pouvoir generer des posts en s'inspirant des formats les plus performants."))
story.append(bullet("<b>Generateur de carrousel</b> : Les posts carrousel (PDF multi-pages) generent 2x plus d'engagement que les posts texte sur LinkedIn. HERMES doit pouvoir generer automatiquement un carrousel a partir d'un sujet, avec un design professionnel, en utilisant la capacite de generation d'images du SDK."))

story.append(h2('5.2 Pipeline de prospection visuel'))
story.append(body(
    "Le pipeline actuel (new, contacted, replied, booked, archived) est fonctionnel mais basique. Les utilisateurs veulent une vue Kanban ou pipeline visuelle inspiree de Pipedrive/HubSpot, avec drag-and-drop, filtres avances, et metriques par etape. Cette evolution est particulierement importante car c'est la vue que les utilisateurs commerciaux utilisent le plus frequemment, et elle doit offrir une experience fluide et informative. La bibliotheque @dnd-kit est deja installee dans le projet, ce qui facilite l'implementation du drag-and-drop."
))
story.append(bullet("<b>Vue Kanban interactive</b> : Colonnes glissables pour chaque statut, avec le score ICP visible, le dernier message envoye, le delai depuis le dernier contact, et les actions rapides (envoyer DM, relancer, archiver)."))
story.append(bullet("<b>Metriques de conversion par etape</b> : Taux de conversion entre chaque etape du pipeline (new vers contacted, contacted vers replied, replied vers booked), avec identification des goulots d'etranglement. Ces metriques sont essentielles pour l'Agent Analyse."))
story.append(bullet("<b>Sequences visuelles</b> : Un editeur de sequences type workflow (comme Expandi ou Lemlist) ou l'utilisateur definit visuellement les etapes de sa sequence de prospection avec des conditions et des branchements."))

story.append(h2('5.3 Modele de revenus et monetisation'))
story.append(body(
    "Pour se differencier des concurrents sur le plan commercial, HERMES peut adopter un modele de revenus innovant qui aligne les interets de l'utilisateur et de la plateforme. L'avantage d'HERMES est que son architecture multi-agents permet de facturer un seul abonnement qui remplace plusieurs outils separes (outil de contenu + outil de prospection + outil de scoring + outil de veille), ce qui cree un rapport valeur/prix tres competitif."
))

story.append(make_table(
    ['Plan', 'Prix', 'Fonctionnalites', 'Cible'],
    [
        ['Gratuit', '0 EUR/mois', '1 compte LinkedIn, 5 generations IA/jour, 1 agent actif, simulation uniquement', 'Decouverte et validation du concept'],
        ['Pro', '49 EUR/mois', '3 comptes LinkedIn, generations IA illimitees, 8 agents actifs, integrations CRM basiques', 'Freelances et consultants B2B'],
        ['Team', '99 EUR/mois/utilisateur', 'Comptes illimites, collaboration, analytics avances, API webhooks, support prioritaire', 'Equipes commerciales et agences'],
        ['Enterprise', 'Sur devis', 'Deployment on-premise, SSO, compliance avancee, SLA garanti, agents custom', 'Grandes entreprises et groupes'],
    ],
    col_ratios=[0.10, 0.12, 0.42, 0.36]
))
story.append(Spacer(1, 12))

story.append(body(
    "En complement du modele par abonnement, HERMES peut proposer une option innovante de pricing base sur les resultats, ou l'utilisateur paie au RDV genere plutot qu'a l'abonnement. Cette approche est plus risque mais tres attractive pour les utilisateurs qui doutent de l'efficacite de l'outil, car elle elimine le risque financier et aligne les interets de la plateforme sur ceux de l'utilisateur. A plus long terme, une marketplace d'agents specialises (Agent Real Estate, Agent SaaS, Agent Consulting) pourrait creer un ecosysteme de valeur et des revenus recurrents via des commissions sur les ventes."
))

# ═══════════════════════════════════════════════════════
# SECTION 6: FEUILLE DE ROUTE
# ═══════════════════════════════════════════════════════
story.append(Spacer(1, 8))
story.append(h1('6. Feuille de route d\'implementation'))
story.append(body(
    "Voici la feuille de route recommandee, organisee en quatre phases trimestrielles, chacune apportant une valeur ajoutee progressive et mesurable. Chaque phase est congue pour etre livrable independamment, permettant a HERMES de generer de la valeur des le premier trimestre. L'approche est incrementaliste : chaque phase construit sur la precedente, et les dependances critiques sont identifiees pour eviter les blocages."
))

story.append(make_table(
    ['Phase', 'Periode', 'Objectif principal', 'Livrables cles'],
    [
        ['Phase 1', 'T3 2026', 'Fondations et fiabilite', 'Base de donnees persistante avec schema complet, cron jobs robustes avec BullMQ, vrai feed LinkedIn via Unipile ou Apify, dashboard de sante du compte LinkedIn, migration des cles API cote serveur'],
        ['Phase 2', 'T4 2026', 'Intelligence et auto-apprentissage', 'Agent Orchestrateur avec bus d\'evenements, A/B testing automatise des posts, scoring ICP dynamique, optimisation des creneaux basee sur les donnees reelles, memoire partagee entre agents'],
        ['Phase 3', 'T1 2027', 'Integrations et scalabilite', 'Integration CRM bidirectionnelle (HubSpot/Pipedrive), webhooks sortants et entrants, notifications Slack/Discord, pipeline Kanban avec drag-and-drop, calendrier Calendly avec tracking'],
        ['Phase 4', 'T2 2027', 'Differentiation et monetisation', 'Veille web temps reel avec recherche web, generateur de carrousels, compliance engine intelligent, marketplace d\'agents, modele freemium avec pricing base sur les resultats'],
    ],
    col_ratios=[0.08, 0.08, 0.26, 0.58]
))
story.append(Spacer(1, 12))

story.append(h2('6.1 Matrice de priorisation'))
story.append(body(
    "Pour guider l'allocation des ressources, voici une matrice de priorisation qui croise l'impact concurrentiel de chaque evolution avec sa complexite technique. Les evolutions a fort impact et faible complexite doivent etre priorisees en premier, car elles offrent le meilleur retour sur investissement."
))

story.append(make_table(
    ['Evolution', 'Impact concurrentiel', 'Complexite', 'Priorite', 'Dependance'],
    [
        ['Persistance base de donnees', 'TRES ELEVE', 'MOYENNE', 'P1 - Immediat', 'Aucune'],
        ['Migration cles API serveur', 'ELEVE (securite)', 'FAIBLE', 'P1 - Immediat', 'Base de donnees'],
        ['Bus d\'evenements inter-agents', 'TRES ELEVE', 'MOYENNE', 'P1 - Immediat', 'Aucune'],
        ['Vrai feed LinkedIn', 'ELEVE', 'MOYENNE', 'P2 - T3 2026', 'Base de donnees'],
        ['Agent Orchestrateur', 'TRES ELEVE', 'ELEVEE', 'P2 - T4 2026', 'Bus d\'evenements'],
        ['A/B testing automatise', 'ELEVE', 'MOYENNE', 'P2 - T4 2026', 'Base de donnees'],
        ['Integration CRM', 'ELEVE', 'ELEVEE', 'P3 - T1 2027', 'Base de donnees'],
        ['Pipeline Kanban', 'MOYEN', 'FAIBLE', 'P3 - T1 2027', 'Aucune'],
        ['Compliance engine', 'TRES ELEVE', 'ELEVEE', 'P4 - T2 2027', 'Vrai feed LinkedIn'],
        ['Generateur carrousels', 'MOYEN', 'ELEVEE', 'P4 - T2 2027', 'Generation d\'images'],
    ],
    col_ratios=[0.22, 0.16, 0.12, 0.18, 0.32]
))
story.append(Spacer(1, 12))

story.append(h2('6.2 Indicateurs cles de succes'))
story.append(body(
    "Pour mesurer le progres de chaque phase, voici les KPIs recommandes. Ces indicateurs permettent de valider que chaque evolution apporte reellement de la valeur aux utilisateurs et renforce le positionnement concurrentiel d'HERMES. Les valeurs actuelles sont estimees car le systeme fonctionne en mode simulation sans donnees reelles."
))

story.append(make_table(
    ['KPI', 'Valeur actuelle', 'Cible Phase 1', 'Cible Phase 2', 'Cible Phase 4'],
    [
        ['Taux de retention 30 jours', '< 20% (estime)', '40%', '55%', '70%'],
        ['Posts publies via HERMES / semaine', '5 (simule)', '15', '25', '40+'],
        ['Leads qualifies / semaine', '34 (simule)', '20 reels', '40 reels', '80+ reels'],
        ['Taux de reponse aux DMs', '28.5% (simule)', '20% reels', '30% reels', '40%+ reels'],
        ['RDV generes / mois', '8 (simule)', '5 reels', '12 reels', '25+ reels'],
        ['Score de sante LinkedIn', 'N/A', '80+/100', '85+/100', '90+/100'],
        ['NPS utilisateur', 'N/A', '30+', '45+', '60+'],
    ],
    col_ratios=[0.28, 0.18, 0.18, 0.18, 0.18]
))

# ═══════════════════════════════════════════════════════
# SECTION 7: RESUME EXECUTIF
# ═══════════════════════════════════════════════════════
story.append(Spacer(1, 8))
story.append(h1('7. Resume executif'))
story.append(body(
    "HERMES possede un avantage concurrentiel unique et sous-exploite : son architecture multi-agents. Aucun concurrent sur le marche ne propose 8 agents specialises qui collaborerent pour couvrir l'integralite du parcours d'acquisition B2B, du contenu a la prospection en passant par la qualification, le nurturing et l'analyse. Cependant, cet avantage reste theorique tant que les agents fonctionnent de maniere isolee, les donnees sont en memoire volatile, et le feed LinkedIn est simule."
))
story.append(body(
    "Les sept recommandations prioritaires pour faire d'HERMES le leader de son segment sont les suivantes. Premierement, transformer les agents independants en un veritable systeme multi-agents orchestre avec un bus d'evenements et une memoire partagee. Deuxiemement, implementer l'auto-apprentissage pour que la plateforme s'optimise continuellement basee sur les resultats reels. Troisiemement, creer la boucle contenu-prospection unifiee, le facteur de differenciation le plus impactant a court terme. Quatriemement, renforcer la conformite LinkedIn avec un moteur de compliance intelligent et proactif. Cinquiemement, fiabiliser les fondations techniques avec une base de donnees persistante, un scheduling robuste, et un vrai acces au feed LinkedIn. Sixiemement, securiser les cles API en les migrant cote serveur avec chiffrement. Septiemement, implementer les integrations tierces (CRM, Calendly, Slack) pour s'inserer dans l'ecosysteme existant de l'utilisateur."
))
story.append(body(
    "En executant cette feuille de route en quatre phases sur 12 mois, HERMES peut passer d'un prototype fonctionnel a une plateforme de production capable de generer des resultats mesurables et de retenir ses utilisateurs. La Phase 1 est critique car elle transforme HERMES d'un outil de demonstration en un outil de production fiable. La Phase 2 est strategique car elle active le veritable potentiel de l'architecture multi-agents. Les Phases 3 et 4 sont commerciales car elles ouvrent le marche et monétisent la plateforme. Le positionnement tarifaire recommande (49 EUR/mois pour la version Pro, 99 EUR/mois pour la version Team) place HERMES en dessous du cout cumule des outils concurrents (Waalaxy + Apollo + PhantomBuster = 120-250 EUR/mois), tout en offrant une couverture fonctionnelle superieure grace a l'orchestration multi-agents."
))

# ── Build Body PDF ──
body_path = '/home/z/my-project/download/hermes-body.pdf'
doc = TocDocTemplate(
    body_path,
    pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOT_M,
    title='HERMES - Analyse Concurrentielle et Recommandations Strategiques 2026',
    author='Z.ai',
    creator='Z.ai'
)
doc.multiBuild(story)
print(f"Body PDF generated: {body_path}")

# ── Generate Cover HTML ──
cover_html = '''<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HERMES - Couverture</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  @page { size: 794px 1123px; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { margin: 0; padding: 0; width: 794px; height: 1123px; overflow: hidden; }
  .cover {
    width: 794px; height: 1123px;
    background: #fafaf9;
    position: relative;
    font-family: 'DM Sans', -apple-system, system-ui, sans-serif;
    display: flex;
    flex-direction: column;
  }
  .accent-bar {
    position: absolute; top: 0; left: 0; right: 0; height: 6px;
    background: linear-gradient(90deg, #5b32d4 0%, #7a7258 50%, #3db579 100%);
  }
  .left-line {
    position: absolute; left: 72px; top: 120px; bottom: 120px; width: 1px;
    background: rgba(111, 103, 79, 0.15);
  }
  .content {
    flex: 1;
    padding: 120px 80px 80px 100px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
    z-index: 1;
  }
  .kicker {
    font-size: 11px; font-weight: 600;
    letter-spacing: 3px; text-transform: uppercase;
    color: #a18943; margin-bottom: 32px;
  }
  .hero-title {
    font-size: 48px; font-weight: 300;
    line-height: 1.1; letter-spacing: -1.5px;
    color: #171615; margin-bottom: 24px;
  }
  .hero-title .highlight {
    color: #5b32d4; font-weight: 500;
  }
  .subtitle {
    font-size: 18px; font-weight: 400;
    color: #7a7871; line-height: 1.6;
    max-width: 500px; margin-bottom: 48px;
  }
  .meta {
    display: flex; gap: 40px;
    margin-top: auto;
    padding-top: 32px;
    border-top: 1px solid rgba(111, 103, 79, 0.12);
  }
  .meta-item {
    display: flex; flex-direction: column; gap: 4px;
  }
  .meta-label {
    font-size: 10px; font-weight: 600;
    letter-spacing: 1.5px; text-transform: uppercase;
    color: #a18943;
  }
  .meta-value {
    font-size: 14px; font-weight: 500;
    color: #171615;
  }
  .summary-box {
    background: rgba(91, 50, 212, 0.04);
    border: 1px solid rgba(91, 50, 212, 0.12);
    border-radius: 12px;
    padding: 24px 28px;
    margin-bottom: 48px;
    max-width: 520px;
  }
  .summary-box p {
    font-size: 14px; color: #4a4a47; line-height: 1.7;
  }
  .corner-mark {
    position: absolute; bottom: 80px; right: 80px;
    font-family: 'DM Mono', monospace;
    font-size: 72px; font-weight: 500;
    color: rgba(91, 50, 212, 0.06);
    letter-spacing: -4px;
    line-height: 1;
  }
</style>
</head>
<body>
<div class="cover">
  <div class="accent-bar"></div>
  <div class="left-line"></div>
  <div class="content">
    <div class="kicker">Strategie et analyse competitive</div>
    <h1 class="hero-title">HERMES<br><span class="highlight">8 agents IA</span> pour<br>l'acquisition B2B</h1>
    <div class="summary-box">
      <p>Analyse concurrentielle du marche 2026, diagnostic technique du codebase, recommandations strategiques prioritarites et feuille de route d'implementation en quatre phases pour transformer HERMES en plateforme leader de l'acquisition B2B autonome.</p>
    </div>
    <div class="subtitle">Analyse concurrentielle, recommandations strategiques et feuille de route d'implementation 2026-2027</div>
    <div class="meta">
      <div class="meta-item">
        <span class="meta-label">Version</span>
        <span class="meta-value">2.0</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Date</span>
        <span class="meta-value">Juin 2026</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Classification</span>
        <span class="meta-value">Confidentiel</span>
      </div>
    </div>
  </div>
  <div class="corner-mark">2026</div>
</div>
</body>
</html>'''

cover_html_path = '/home/z/my-project/download/cover_hermes.html'
with open(cover_html_path, 'w', encoding='utf-8') as f:
    f.write(cover_html)
print(f"Cover HTML written: {cover_html_path}")

# ── Render Cover PDF ──
scripts_dir = '/home/z/my-project/skills/pdf/scripts'
cover_pdf_path = '/home/z/my-project/download/cover_hermes.pdf'

result = subprocess.run(
    ['node', os.path.join(scripts_dir, 'html2poster.js'), cover_html_path,
     '--output', cover_pdf_path, '--width', '794px'],
    capture_output=True, text=True, timeout=60
)
print(f"Cover render stdout: {result.stdout}")
if result.returncode != 0:
    print(f"Cover render stderr: {result.stderr}")
    raise RuntimeError(f"Cover render failed: {result.stderr}")

# ── Merge Cover + Body ──
from pypdf import PdfReader, PdfWriter, Transformation

A4_W, A4_H = 595.28, 841.89

def normalize_page_to_a4(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 2 or abs(h - A4_H) > 2:
        sx, sy = A4_W / w, A4_H / h
        page.add_transformation(Transformation().scale(sx=sx, sy=sy))
        page.mediabox.lower_left = (0, 0)
        page.mediabox.upper_right = (A4_W, A4_H)
    return page

output_path = '/home/z/my-project/download/hermes-analyse-concurrentielle-2026.pdf'
writer = PdfWriter()

# Cover as page 1
cover_page = PdfReader(cover_pdf_path).pages[0]
writer.add_page(normalize_page_to_a4(cover_page))

# Body pages follow
for page in PdfReader(body_path).pages:
    writer.add_page(normalize_page_to_a4(page))

writer.add_metadata({
    '/Title': 'HERMES - Analyse Concurrentielle et Recommandations Strategiques 2026',
    '/Author': 'Z.ai',
    '/Creator': 'Z.ai',
    '/Subject': 'Strategie competitive et feuille de route pour la plateforme HERMES'
})
with open(output_path, 'wb') as f:
    writer.write(f)

print(f"\nFinal PDF generated: {output_path}")
print(f"Pages: cover + {len(PdfReader(body_path).pages)} body pages = {1 + len(PdfReader(body_path).pages)} total")
