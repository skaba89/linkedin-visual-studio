#!/usr/bin/env python3
"""HERMES - Recommandations Strategiques et Evolutions Competitives"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, CondPageBreak, Image
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import SimpleDocTemplate
import hashlib, os

# ── Fonts ──
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/chinese/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Bold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('Carlito', normal='Carlito', bold='Carlito-Bold')
registerFontFamily('LiberationSerif', normal='LiberationSerif', bold='LiberationSerif')

# ── Palette ──
PAGE_BG       = colors.HexColor('#eff1f0')
SECTION_BG    = colors.HexColor('#eaedeb')
CARD_BG       = colors.HexColor('#e6ebe8')
TABLE_STRIPE  = colors.HexColor('#e9ebea')
HEADER_FILL   = colors.HexColor('#3c614f')
COVER_BLOCK   = colors.HexColor('#517362')
BORDER        = colors.HexColor('#bac9c1')
ICON          = colors.HexColor('#44926b')
ACCENT        = colors.HexColor('#1e941e')
ACCENT_2      = colors.HexColor('#49cc6a')
TEXT_PRIMARY   = colors.HexColor('#212422')
TEXT_MUTED     = colors.HexColor('#848e89')
SEM_SUCCESS   = colors.HexColor('#489662')
SEM_WARNING   = colors.HexColor('#aa8c4e')

# ── Page ──
PAGE_W, PAGE_H = A4
LEFT_M = 1.0 * inch
RIGHT_M = 1.0 * inch
TOP_M = 0.8 * inch
BOT_M = 0.8 * inch
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
    'H2', fontName='Carlito', fontSize=15, leading=20,
    alignment=TA_LEFT, spaceBefore=14, spaceAfter=8, textColor=COVER_BLOCK
)
h3_style = ParagraphStyle(
    'H3', fontName='Carlito', fontSize=12, leading=17,
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
    'HeaderCell', fontName='Carlito', fontSize=10, leading=14,
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

# ── Helper ──
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
story.append(Paragraph('<b>Table des matieres</b>', ParagraphStyle('TOCTitle', fontName='Carlito', fontSize=18, leading=24, alignment=TA_LEFT, textColor=HEADER_FILL, spaceAfter=12)))
story.append(toc)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════
# SECTION 1: ANALYSE CONCURRENTIELLE
# ═══════════════════════════════════════════════════════
story.append(h1('1. Analyse concurrentielle du marche'))
story.append(body(
    "Le marche des outils d'automatisation LinkedIn et de prospection B2B connait une croissance rapide en 2026, porte par la democratisation de l'IA generative et l'explosion du social selling. Plusieurs categories de concurrents se disputent ce segment, chacun avec des forces et des limites specifiques. Comprendre leurs positionnements respectifs est essentiel pour identifier les opportunites de differenciation strategique pour HERMES."
))

story.append(h2('1.1 Les principaux concurrents'))
story.append(body(
    "Le paysage concurrentiel se structure autour de trois categories d'acteurs : les outils d'automatisation LinkedIn pur, les plateformes de sales engagement multicanal, et les solutions d'IA generative pour la vente. Chacun couvre une partie du parcours de prospection, mais aucun ne propose une veritable orchestration multi-agents autonome."
))

story.append(make_table(
    ['Concurrent', 'Categorie', 'Forces', 'Limites', 'Tarif'],
    [
        ['Waalaxy', 'Automatisation LinkedIn', 'Interface simple, campagnes automatisees, freemium', 'Pas d\'IA generative, pas de scoring ICP, mono-canal', '19-66 EUR/mois'],
        ['Lemlist', 'Sales engagement multicanal', 'Multicanal (email + LinkedIn), personalisation avancee', 'Focalise email, pas d\'agents autonomes, pas de veille', '59-119 EUR/mois'],
        ['La Growth Machine', 'Multicanal LinkedIn + email + Twitter', 'Sequences multicanal, enrichment, Social Warming', 'Pas d\'IA strategique, pas de scoring dynamique', '60-165 EUR/mois'],
        ['Expandi', 'Automatisation LinkedIn avancee', 'Branches conditionnelles, Smart Sequences, safety', 'Pas d\'IA, pas de contenu auto, interface complexe', '49-99 EUR/mois'],
        ['Apollo.io', 'Base de donnees B2B + IA', 'Base massive, scoring IA, integration CRM', 'Pas d\'agents, pas de publication auto, pas de veille', '49-119 EUR/mois'],
        ['PhantomBuster', 'Scraping + automatisation', 'API puissantes, scraping en masse, multi-reseaux', 'Pas d\'IA, pas de contenu, technique a configurer', '56-224 EUR/mois'],
        ['Humanlinker', 'IA + prospection LinkedIn', 'Ultra-personnalisation IA, analyse DISC', 'Pas d\'agents, pas de publication, pas de veille', '39-99 EUR/mois'],
    ],
    col_ratios=[0.12, 0.14, 0.26, 0.30, 0.18]
))
story.append(Spacer(1, 12))

story.append(h2('1.2 Lacunes identifiees chez les concurrents'))
story.append(body(
    "L'analyse approfondie de ces solutions revele cinq lacunes majeures que personne ne comble actuellement de maniere integree. Ces lacunes representent autant d'opportunites strategiques pour HERMES, car elles correspondent a des besoins reels et non satisfaits des equipes commerciales B2B."
))
story.append(bullet("<b>Absence d'orchestration intelligente</b> : Les concurrents proposent des sequences lineaires (si A alors B), mais aucun ne propose un veritable systeme multi-agents ou chaque agent est specialise et collabore avec les autres de facon autonome. Les sequences restent rigides et ne s'adaptent pas en temps reel au comportement du prospect."))
story.append(bullet("<b>Pas de boucle de retroaction</b> : Les outils actuels n'apprennent pas de leurs resultats. Si un type de message ne genere pas de reponses, l'outil continue a l'envoyer. Il n'existe pas de mecanisme d'auto-optimisation base sur les metriques reelles d'engagement."))
story.append(bullet("<b>Contenu IA generique</b> : Meme les outils integres a l'IA (Humanlinker, Apollo) generent du contenu de maniere isolee, sans prendre en compte le contexte strategique global de l'entreprise, son ICP, ses posts recents, les tendances du marche. Le resultat est souvent generique et peu diferenciant."))
story.append(bullet("<b>Silo entre publication et prospection</b> : Les outils se divisent en deux camps : ceux qui publient (Buffer, Hootsuite) et ceux qui prospectent (Waalaxy, Expandi). Aucun ne relie les deux de maniere fluide, alors que le contenu publie alimente directement la prospection."))
story.append(bullet("<b>Pas de conformite proactive</b> : Les limites LinkedIn sont gerees manuellement ou via des securites basiques. Aucun outil ne propose une conformite intelligente qui ajuste le rythme d'activite en fonction des signaux de risque en temps reel."))

# ═══════════════════════════════════════════════════════
# SECTION 2: RECOMMANDATIONS STRATEGIQUES
# ═══════════════════════════════════════════════════════
story.append(Spacer(1, 8))
story.append(h1('2. Recommandations strategiques'))
story.append(body(
    "Sur la base de l'analyse concurrentielle et des tendances du marche, voici les recommandations strategiques prioritaires pour transformer HERMES d'un outil de prospection en une plateforme d'acquisition B2B autonome et leader sur son segment."
))

story.append(h2('2.1 Devenir la premiere plateforme multi-agents autonome'))
story.append(body(
    "Le concept de multi-agents est l'avantage concurrentiel le plus puissant d'HERMES, mais il est actuellement sous-exploite. Les agents fonctionnent de maniere sequentielle et independante, sans veritable coordination intelligente. Pour se differencier radicalement, HERMES doit evoluer vers un systeme ou les agents communiquent, s'adaptent et prennent des decisions collaboratives en temps reel. Cela signifie qu'un signal detecte par l'Agent Veille (par exemple, une tendance emergente sur l'IA agentique) declenche automatiquement l'Agent Contenu pour creer un post, qui lui-meme alimente l'Agent Qualification pour identifier les prospects interesses par ce sujet, qui active l'Agent Prospection avec un message personnalise faisant reference a cette tendance."
))
story.append(bullet("<b>Orchestrateur central</b> : Creer un Agent Orchestrateur (Agent 00) qui supervise les 8 agents, detecte les opportunites cross-agents, et dispatche les taches en temps reel plutot que de suivre un planning fixe."))
story.append(bullet("<b>Bus d'evenements</b> : Implementer un systeme de messagerie asynchrone entre agents (ex: Redis Pub/Sub ou EventEmitter interne) pour remplacer les plannings rigides par des declenchements evenementiels."))
story.append(bullet("<b>Memoire partagee</b> : Chaque agent doit pouvoir acceder aux resultats des autres agents en temps reel, pas seulement aux donnees en base. L'Agent Prospection doit savoir quels sujets sont tendance via l'Agent Veille, et quels posts ont performe via l'Agent Contenu."))

story.append(h2('2.2 Implementer l\'auto-apprentissage et l\'optimisation continue'))
story.append(body(
    "Aujourd'hui, l'Agent Analyse produit des recommandations mais celles-ci ne sont jamais appliquees automatiquement. HERMES doit fermer la boucle de retroaction : mesurer les resultats de chaque action, identifier ce qui fonctionne, et ajuster les strategies en consequence. C'est la difference entre un outil qui execute et un systeme qui apprend."
))
story.append(bullet("<b>A/B testing automatise</b> : L'Agent Contenu genere automatiquement 2 variantes d'un meme post (hook different, ton different, format different), publie la variante A le lundi et la variante B le mardi, mesure l'engagement, et ajuste les generations futures en consequence."))
story.append(bullet("<b>Scoring dynamique de l'ICP</b> : L'ICP ne doit plus etre statique. Si les leads avec le titre 'Head of Growth' convertissent a 35% mais les 'CMO' seulement a 12%, le scoring doit s'ajuster automatiquement en pondérant le critere 'titre' differemment."))
story.append(bullet("<b>Optimisation des creneaux</b> : Au lieu de se baser sur des donnees generales (les creneaux B2B optimaux), HERMES doit analyser les propres donnees de l'utilisateur : quand ses posts obtiennent le plus d'engagement, quand ses DMs ont le meilleur taux de reponse, et adapter les plannings en consequence."))

story.append(h2('2.3 Creer la boucle contenu-prospection unifiee'))
story.append(body(
    "C'est le facteur de differenciation le plus impactant a court terme. Aucun concurrent ne relie actuellement la creation de contenu a la prospection de maniere intelligente. HERMES est le seul outil qui possede a la fois un Agent Contenu et un Agent Prospection dans la meme plateforme. Il faut exploiter cette unicite."
))
story.append(bullet("<b>Prospection contextuelle</b> : Quand l'Agent Prospection genere un DM, il doit automatiquement faire reference au dernier post publie par l'utilisateur : 'J'ai vu que vous aviez aime mon post sur le scoring ICP dynamique...'. Ce contexte rend le message 3x plus pertinent qu'un cold DM generique."))
story.append(bullet("<b>Alimentation inverse</b> : Quand un prospect repond positivement a un DM, l'Agent Contenu doit generer un post sur le sujet qui a attire ce prospect, pour reproduire le meme effet d'attraction."))
story.append(bullet("<b>Signaux d'achat en temps reel</b> : Si un prospect like 3 posts consecutifs sur le meme sujet, c'est un signal d'achat fort. HERMES doit detecter ces sequences et alerter l'Agent Prospection en priorite haute."))

story.append(h2('2.4 Renforcer la conformite et la securite LinkedIn'))
story.append(body(
    "Le risque numero un pour tout utilisateur d'outils d'automatisation LinkedIn est le bannissement de son compte. Les concurrents gerent ce risque de maniere reactive (limites journalieres fixes). HERMES peut se differencier avec une approche proactive et intelligente de la conformite, qui s'adapte en temps reel aux signaux de risque."
))
story.append(bullet("<b>Compliance engine intelligent</b> : Au lieu de limites fixes (ex: 80 invitations/jour), implementer un moteur qui ajuste dynamiquement les limites en fonction de l'age du compte, du taux d'acceptation recent, du volume d'activite des 7 derniers jours, et des signaux d'avertissement LinkedIn (CAPTCHA, restriction temporaire)."))
story.append(bullet("<b>Mode ghost</b> : Un mode qui simule le comportement humain avec des pauses aleatoires, des vitesses de frappe variables, des sessions de navigation organiques entre les actions d'automatisation."))
story.append(bullet("<b>Dashboard de sante du compte</b> : Un indicateur en temps reel du 'score de sante' LinkedIn, avec des alertes precoces quand le comportement est suspect, et des recommandations de reduction d'activite."))

# ═══════════════════════════════════════════════════════
# SECTION 3: EVOLUTIONS TECHNIQUES
# ═══════════════════════════════════════════════════════
story.append(Spacer(1, 8))
story.append(h1('3. Evolutions techniques prioritaires'))
story.append(body(
    "Au-dela de la strategie, des evolutions techniques concretes sont necessaires pour transformer HERMES en plateforme de reference. Voici les implementations prioritaires classees par impact et complexite."
))

story.append(h2('3.1 Persistance des donnees et base de donnees'))
story.append(body(
    "Actuellement, les posts planifies sont stockes en memoire vive et perdus au redemarrage du serveur. C'est un probleme critique pour un outil de production. La migration vers une base de donnees persistante est la priorite technique numero un. Prisma et SQLite sont deja configures dans le projet, il faut les utiliser pleinement pour stocker les leads, les posts, les sequences de messages, les metriques d'engagement, et l'historique des actions de chaque agent."
))
story.append(bullet("<b>Migration Prisma complete</b> : Etendre le schema Prisma pour couvrir tous les modeles : ScheduledPost, GeneratedPost, Lead, GeneratedMessage, GeneratedComment, MarketBriefing, NurturingAction, PerformanceInsight, ConnectionRequest, ActivityLog."))
story.append(bullet("<b>Historisation des metriques</b> : Stocker les metriques d'engagement par jour et par post pour permettre l'analyse de tendances et l'auto-apprentissage. Sans historique, il n'y a pas d'optimisation possible."))
story.append(bullet("<b>Synchronisation multi-appareils</b> : Avec une base de donnees cote serveur, les donnees ne sont plus liees au localStorage du navigateur. L'utilisateur peut acceder a ses donnees depuis n'importe quel appareil."))

story.append(h2('3.2 Vrai feed LinkedIn via scraping'))
story.append(body(
    "Le feed LinkedIn actuel est simule avec des donnees predefinies. L'acces au vrai feed est indispensable pour que l'Agent Engagement et l'Agent Commenter puissent fonctionner reellement. L'API LinkedIn Marketing Developer Platform est reservee aux partenaires entreprise, mais des alternatives techniques existent pour recuperer le feed reel."
))
story.append(bullet("<b>Integration Apify/PhantomBuster</b> : Utiliser les scrapers Apify ou PhantomBuster comme source de donnees pour le feed LinkedIn. Ces services contournent les limitations de l'API officielle et fournissent des donnees structurees en temps reel."))
story.append(bullet("<b>Scraping navigateur via Playwright</b> : Implementer un module de scraping cote serveur avec Playwright pour extraire le feed directement depuis la session LinkedIn de l'utilisateur. Plus complexe mais independant de services tiers."))
story.append(bullet("<b>Cache intelligent du feed</b> : Pour eviter de scraper trop frequemment, mettre en place un systeme de cache avec des WebSockets qui notifie le frontend quand de nouveaux posts sont disponibles."))

story.append(h2('3.3 API webhooks et integrations tierces'))
story.append(body(
    "HERMES fonctionne actuellement en silo. Pour devenir un hub d'acquisition B2B, il doit s'integrer avec l'ecosysteme existant de l'utilisateur : CRM, calendrier, outils d'email, plateformes d'analytics. Les webhooks sont le mecanisme le plus flexible pour ces integrations."
))
story.append(bullet("<b>Integration HubSpot/Pipedrive</b> : Synchroniser les leads qualifies et les statuts de prospection bidirectionnellement avec le CRM de l'utilisateur. Quand un lead passe 'booked' dans HERMES, il est automatiquement cree comme deal dans le CRM."))
story.append(bullet("<b>Integration Calendly/Cal.com</b> : Inclure automatiquement le lien de reservation dans les DMs de prospection quand le lead est chaud, et tracker les RDV pris via les webhooks Calendly."))
story.append(bullet("<b>Notifications Slack/Discord</b> : Envoyer des alertes en temps reel quand un lead cible repond, quand un post depasse un seuil d'engagement, ou quand l'Agent Analyse detecte une anomalie."))

story.append(h2('3.4 Scheduling robuste avec cron jobs'))
story.append(body(
    "Le systeme de planification actuel repose sur un setInterval cote serveur qui verifie les posts planifies toutes les 30 secondes. Ce n'est pas fiable : les posts sont perdus au redemarrage, il n'y a pas de mecanisme de retry, et la precision est mediocre. Un systeme de cron jobs robuste est indispensable pour un outil de production."
))
story.append(bullet("<b>node-cron ou BullMQ</b> : Utiliser BullMQ avec Redis pour une file de taches persistante avec retry automatique, delays, et priorites. Chaque post planifie devient un job dans la file."))
story.append(bullet("<b>Timezone-aware scheduling</b> : Permettre a l'utilisateur de specifier son fuseau horaire et planifier les posts en consequence. Un post planifie a 8h00 doit etre publie a 8h00 dans le fuseau de l'utilisateur, pas du serveur."))
story.append(bullet("<b>Monitoring des jobs</b> : Un dashboard de monitoring des taches planifiees avec statut (en attente, en cours, publie, echoue), logs d'execution, et possibilite de replanifier manuellement."))

# ═══════════════════════════════════════════════════════
# SECTION 4: EVOLUTIONS FONCTIONNELLES
# ═══════════════════════════════════════════════════════
story.append(Spacer(1, 8))
story.append(h1('4. Evolutions fonctionnelles a fort impact'))
story.append(body(
    "Au-dela des evolutions techniques, des fonctionnalites nouvelles peuvent transformer l'experience utilisateur et creer des barrières a l'entree significatives contre la concurrence."
))

story.append(h2('4.1 Intelligence de contenu contextuelle'))
story.append(body(
    "L'Agent Contenu genere actuellement des posts a partir de sujets predefinies ou de suggestions IA generiques. Pour creer un avantage competitif durable, l'Agent doit acceder a des sources d'information en temps reel pour produire du contenu unique, credible et impossible a reproduire par un concurrent."
))
story.append(bullet("<b>Veille web en temps reel</b> : L'Agent Veille scrape les actualites IA/B2B du jour (via web search), identifie les angles non couverts, et alimente l'Agent Contenu avec des sujets frais et des donnees verifiees. Chaque post peut citer une source recente, ce qui credibilite le contenu et attire l'engagement."))
story.append(bullet("<b>Analyse des posts viraux</b> : Identifier les posts LinkedIn qui generent le plus d'engagement dans la niche de l'utilisateur, analyser leur structure (hook, format, longueur, CTA), et reproduire les patterns qui fonctionnent."))
story.append(bullet("<b>Generateur de carrousel</b> : Les posts carrousel (PDF multi-pages) generent 2x plus d'engagement que les posts texte sur LinkedIn. HERMES doit pouvoir generer automatiquement un carrousel a partir d'un sujet, avec un design professionnel."))

story.append(h2('4.2 Pipeline de prospection visuel'))
story.append(body(
    "Le pipeline actuel (new, contacted, replied, booked, archived) est fonctionnel mais basique. Les utilisateurs veulent une vue Kanban ou pipeline visuelle inspiree de Pipedrive/HubSpot, avec drag-and-drop, filtres avances, et metriques par etape."
))
story.append(bullet("<b>Vue Kanban interactive</b> : Colonnes glissables pour chaque statut, avec le score ICP visible, le dernier message envoye, le delai depuis le dernier contact, et les actions rapides (envoyer DM, relancer, archiver)."))
story.append(bullet("<b>Metriques de conversion par etape</b> : Taux de conversion entre chaque etape du pipeline (new vers contacted, contacted vers replied, replied vers booked), avec identification des goulots d'etranglement."))
story.append(bullet("<b>Sequences visuelles</b> : Un editeur de sequences type workflow (comme Expandi ou Lemlist) ou l'utilisateur definit visuellement les etapes de sa sequence de prospection avec des conditions et des branchements."))

story.append(h2('4.3 Modele de revenus et monetisation'))
story.append(body(
    "Pour se differencier des concurrents sur le plan commercial, HERMES peut adopter un modele de revenus innovant qui aligne les interets de l'utilisateur et de la plateforme."
))
story.append(bullet("<b>Freemium avec credit IA</b> : Version gratuite avec 5 generations IA par jour et 1 compte LinkedIn. Version Pro a 49 EUR/mois avec generations illimitees, 3 comptes LinkedIn, et integrations CRM. Version Team a 99 EUR/mois par utilisateur avec collaboration et analytics avances."))
story.append(bullet("<b>Pricing base sur les resultats</b> : Une option innovante ou l'utilisateur paie au RDV genere plutot qu'a l'abonnement. Plus risqué mais tres attractif pour les utilisateurs qui doutent de l'efficacite de l'outil."))
story.append(bullet("<b>Marketplace d'agents</b> : A plus long terme, permettre a la communaute de creer et vendre des agents specialises (Agent Real Estate, Agent SaaS, Agent Consulting) sur une marketplace, prelevant une commission sur chaque vente."))

# ═══════════════════════════════════════════════════════
# SECTION 5: FEUILLE DE ROUTE
# ═══════════════════════════════════════════════════════
story.append(Spacer(1, 8))
story.append(h1('5. Feuille de route d\'implementation'))
story.append(body(
    "Voici la feuille de route recommandee, organisee en quatre phases trimestrielles, chacune apportant une valeur ajoutee progressive et mesurable. Chaque phase est congue pour etre livrable independamment, permettant a HERMES de generer de la valeur des le premier trimestre."
))

story.append(make_table(
    ['Phase', 'Periode', 'Objectif principal', 'Livrables cles'],
    [
        ['Phase 1', 'T3 2026', 'Fondations et fiabilite', 'Base de donnees persistante, cron jobs robustes, vrai feed LinkedIn via scraping, dashboard de sante du compte LinkedIn'],
        ['Phase 2', 'T4 2026', 'Intelligence et auto-apprentissage', 'Orchestrateur multi-agents, A/B testing automatise, scoring ICP dynamique, optimisation des creneaux basee sur les donnees reelles'],
        ['Phase 3', 'T1 2027', 'Integrations et scalabilite', 'Integration CRM (HubSpot/Pipedrive), webhooks, notifications Slack/Discord, pipeline Kanban, calendrier Calendly'],
        ['Phase 4', 'T2 2027', 'Differentiation et monetisation', 'Veille web temps reel, generateur de carrousels, compliance engine intelligent, marketplace d\'agents, modele freemium'],
    ],
    col_ratios=[0.10, 0.12, 0.30, 0.48]
))
story.append(Spacer(1, 12))

story.append(h2('5.1 Indicateurs cles de succes'))
story.append(body(
    "Pour mesurer le progres de chaque phase, voici les KPIs recommandes. Ces indicateurs permettent de valider que chaque evolution apporte reellement de la valeur aux utilisateurs et renforce le positionnement concurrentiel d'HERMES."
))
story.append(make_table(
    ['KPI', 'Valeur actuelle', 'Cible Phase 1', 'Cible Phase 2', 'Cible Phase 4'],
    [
        ['Taux de retention 30 jours', '< 20% (estime)', '40%', '55%', '70%'],
        ['Posts publies via HERMES / semaine', '5 (simule)', '15', '25', '40+'],
        ['Leads qualifies / semaine', '34 (simule)', '20 reels', '40 reels', '80+ reels'],
        ['Taux de reponse aux DMs', '28.5% (simule)', '20% reels', '30% reels', '40%+ reels'],
        ['RDV generes / mois', '8 (simule)', '5 reels', '12 reels', '25+ reels'],
        ['NPS utilisateur', 'N/A', '30+', '45+', '60+'],
    ],
    col_ratios=[0.28, 0.18, 0.18, 0.18, 0.18]
))

# ═══════════════════════════════════════════════════════
# SECTION 6: RESUME EXECUTIF
# ═══════════════════════════════════════════════════════
story.append(Spacer(1, 8))
story.append(h1('6. Resume executif'))
story.append(body(
    "HERMES possede un avantage concurrentiel unique et sous-exploite : son architecture multi-agents. Aucun concurrent sur le marche ne propose 8 agents specialises qui collaborerent pour couvrir l'integralite du parcours d'acquisition B2B, du contenu a la prospection en passant par la qualification, le nurturing et l'analyse. Cependant, cet avantage reste theorique tant que les agents fonctionnent de maniere isolee, les donnees sont en memoire volatile, et le feed LinkedIn est simule."
))
story.append(body(
    "Les cinq recommandations prioritaires pour faire d'HERMES le leader de son segment sont les suivantes. Premierement, transformer les agents independants en un veritable systeme multi-agents orchestre, ou chaque agent communique et s'adapte en temps reel. Deuxiemement, implementer l'auto-apprentissage pour que la plateforme s'optimise continuellement basee sur les resultats reels. Troisiemement, creer la boucle contenu-prospection unifiee, le facteur de differenciation le plus impactant a court terme. Quatriemement, renforcer la conformite LinkedIn avec un moteur de compliance intelligent et proactif. Cinquiemement, fiabiliser les fondations techniques avec une base de donnees persistante, un scheduling robuste, et un vrai acces au feed LinkedIn."
))
story.append(body(
    "En executant cette feuille de route en quatre phases sur 12 mois, HERMES peut passer d'un prototype fonctionnel a une plateforme de production capable de generer des resultats mesurables et de retenir ses utilisateurs. La Phase 1 est critique car elle transforme HERMES d'un outil de demonstration en un outil de production fiable. La Phase 2 est strategique car elle active le veritable potentiel de l'architecture multi-agents. Les Phases 3 et 4 sont commercialles car elles ouvrent le marche et monétisent la plateforme."
))

# ── Build ──
output_path = '/home/z/my-project/download/hermes-recommandations-strategiques.pdf'
doc = TocDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOT_M,
    title='HERMES - Recommandations Strategiques et Evolutions Competitives',
    author='Z.ai',
    creator='Z.ai'
)
doc.multiBuild(story)
print(f"PDF generated: {output_path}")
