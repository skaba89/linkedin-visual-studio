# HERMÈS — Guide de Déploiement Production (Render)

> **Phase 5.1** — Guide complet pour déployer HERMÈS sur Render avec PostgreSQL, cron jobs, LinkedIn OAuth, et Stripe billing.
>
> **Prérequis** : un compte GitHub, un compte Render, un compte LinkedIn Developer, un compte Stripe (optionnel pour la facturation).

---

## 📋 Sommaire

1. [Architecture cible](#1-architecture-cible)
2. [Préparation : base de données PostgreSQL](#2-préparation--base-de-données-postgresql)
3. [Créer le Web Service sur Render](#3-créer-le-web-service-sur-render)
4. [Variables d'environnement (obligatoires + optionnelles)](#4-variables-denvironnement)
5. [Premier déploiement](#5-premier-déploiement)
6. [Configuration LinkedIn OAuth](#6-configuration-linkedin-oauth)
7. [Configuration Stripe (billing)](#7-configuration-stripe-billing)
8. [Cron Jobs Render (6 jobs obligatoires)](#8-cron-jobs-render)
9. [Vérification post-déploiement](#9-vérification-post-déploiement)
10. [Dépannage (troubleshooting)](#10-dépannage)

---

## 1. Architecture cible

```
┌──────────────────────────────────────────────────────────────┐
│                       Render (production)                     │
│                                                               │
│  ┌──────────────────┐    ┌──────────────────────────────┐    │
│  │  Web Service     │    │  Cron Jobs (6)               │    │
│  │  Next.js 16      │    │  - agents (toutes les 5 min) │    │
│  │  Node 22         │    │  - metrics-sync (1×/jour)    │    │
│  │  Port 10000      │    │  - token-refresh (1×/jour)   │    │
│  │                  │    │  - reactor-capture (2×/jour)  │    │
│  │  startCommand:   │    │  - trending-detect (3×/jour) │    │
│  │  bash start.sh   │    │  - trending-engage (4×/jour) │    │
│  └────────┬─────────┘    │  - integrations-sync (6h)   │    │
│           │              └──────────────────────────────┘    │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────────────────────┐                       │
│  │  Neon PostgreSQL (serverless)    │                       │
│  │  DATABASE_URL=postgresql://...   │                       │
│  └──────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────┘
        ▲
        │ HTTPS
        ▼
   Utilisateurs finaux (https://linkedin-visual-studio.onrender.com)
```

---

## 2. Préparation : base de données PostgreSQL

HERMÈS utilise **Neon** (serverless PostgreSQL) — gratuit jusqu'à 0.5 GB.

### 2.1 Créer une base Neon

1. Aller sur https://console.neon.tech
2. Créer un compte / se connecter avec GitHub
3. "New project" → Region: **Frankfurt (eu-central-1)** (le plus proche de Render)
4. PostgreSQL version: **16** (ou supérieur)
5. Une fois créé, copier la `Connection string` :
   ```
   postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/hermes?sslmode=require
   ```

> ⚠️ **Important** : conservez cette URL, elle sera utilisée comme `DATABASE_URL` dans Render.

---

## 3. Créer le Web Service sur Render

### 3.1 Depuis le dashboard Render

1. Aller sur https://dashboard.render.com
2. "New +" → **Web Service**
3. Connecter le repo GitHub `skaba89/linkedin-visual-studio`
4. Branch: **main**

### 3.2 Configuration

| Champ | Valeur |
|-------|--------|
| **Name** | `hermes-app` (ou `linkedin-visual-studio`) |
| **Runtime** | Node |
| **Build Command** | `bash build.sh` |
| **Start Command** | `bash start.sh` |
| **Plan** | Starter ($7/mois — requis pour les cron jobs) |
| **Region** | Frankfurt (eu-central-1) — cohérent avec Neon |
| **Branch** | main |

> 💡 **Pourquoi `bash start.sh` ?** Ce script exécute `prisma migrate deploy` puis `npm run start`. Il a des fallbacks automatiques (`prisma db push`, `prisma db execute`) si la migration échoue.

### 3.3 Health Check

- **Health Check Path** : `/api/health`

---

## 4. Variables d'environnement

### 4.1 Obligatoires (sans ces vars, l'app ne démarre pas)

Ajouter dans Render → Environment :

| Variable | Valeur | Notes |
|----------|--------|-------|
| `DATABASE_URL` | `postgresql://...neon.tech/hermes?sslmode=require` | Depuis Neon (étape 2.1) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | **Générer une nouvelle valeur** |
| `NEXTAUTH_URL` | `https://linkedin-visual-studio.onrender.com` | URL publique Render |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` | Pour chiffrer les tokens LinkedIn |
| `AUTH_TRUST_HOST` | `true` | Requis pour NextAuth derrière proxy Render |
| `NODE_ENV` | `production` | |
| `PORT` | `10000` | |

### 4.2 LinkedIn OAuth (obligatoire pour la fonctionnalité principale)

| Variable | Valeur |
|----------|--------|
| `LINKEDIN_CLIENT_ID` | Depuis LinkedIn Developer (étape 6) |
| `LINKEDIN_CLIENT_SECRET` | Depuis LinkedIn Developer (étape 6) |

### 4.3 Cron Jobs (obligatoire pour les agents autonomes)

| Variable | Valeur |
|----------|--------|
| `CRON_SECRET` | `openssl rand -hex 32` | Authentifie les cron jobs via header `x-cron-secret` |

### 4.4 LLM API Keys (au moins une requise pour la génération IA)

| Variable | Notes |
|----------|-------|
| `GROQ_API_KEY` | **Recommandé** — gratuit, rapide. https://console.groq.com/keys |
| `OPENAI_API_KEY` | Optionnel (OpenAI GPT-4o) |
| `ANTHROPIC_API_KEY` | Optionnel (Claude 3.5 Sonnet) |
| `OPENROUTER_API_KEY` | Optionnel (multi-modèles) |

### 4.5 Stripe (optionnel — pour activer la facturation)

Voir [section 7](#7-configuration-stripe-billing).

---

## 5. Premier déploiement

### 5.1 Déclencher le déploiement

1. Sauvegarder les variables d'environnement
2. Render va automatiquement lancer le premier build
3. Attendre ~3-5 minutes (build + migration + start)

### 5.2 Vérifier les logs

Dans Render → "Logs" tab, vous devriez voir :

```
═══════════════════════════════════════════════
  HERMÈS — Start (2026-01-15T10:00:00Z)
═══════════════════════════════════════════════

🔍 Environment check:
  NODE_ENV: production
  PORT: 10000
  DATABASE_URL: set (hidden)
  NEXTAUTH_SECRET: set (hidden)
  ENCRYPTION_KEY: set (hidden)

🗄️  Step 1: Running prisma migrate deploy...
✅ prisma migrate deploy succeeded.

🚀 Step 2: Starting Next.js...
```

### 5.3 Premier test

Une fois l'app démarrée, visiter :

```
https://linkedin-visual-studio.onrender.com/api/health
```

Devrait retourner `{"status":"ok"}`.

### 5.4 Diagnostiquer les tables de schéma

Si vous voyez des 500 sur `/api/data/reactors`, `/api/data/profile-visitors`, `/api/data/trending`, ou `/api/data/engagement-settings`, exécutez :

```bash
curl https://linkedin-visual-studio.onrender.com/api/setup/ensure-engagement-tables
```

Cet endpoint force la création de toutes les tables manquantes (idempotent) et retourne un rapport JSON.

---

## 6. Configuration LinkedIn OAuth

### 6.1 Créer l'app LinkedIn Developer

1. Aller sur https://www.linkedin.com/developers/apps/new
2. Remplir :
   - **App name** : HERMÈS
   - **LinkedIn Page** : votre page company (ou créez-en une)
   - **Privacy policy URL** : `https://linkedin-visual-studio.onrender.com/privacy` (à créer)
   - **App logo** : votre logo
3. Accepter les conditions → "Create app"

### 6.2 Activer les produits

Dans l'app LinkedIn Developer → "Products" tab :

1. **Sign In with LinkedIn using OpenID Connect** → "Get started" → cochez tous les scopes
2. **Share on LinkedIn** → "Get started" (pour poster du contenu)

### 6.3 Authentification (credentials)

Dans "Auth" tab :

1. Copier **Client ID** → `LINKEDIN_CLIENT_ID` dans Render
2. Copier **Client Secret** → `LINKEDIN_CLIENT_SECRET` dans Render
3. **Authorized redirect URLs** :
   ```
   https://linkedin-visual-studio.onrender.com/api/linkedin/callback
   ```

### 6.4 Scopes requis

Vérifier que ces scopes sont activés (ils le sont par défaut avec OpenID Connect) :

- `openid` — authentification
- `profile` — nom, photo
- `email` — email
- `r_organization_social` — lire les posts de votre page
- `w_organization_social` — poster des posts
- `r_basicprofile` — profil LinkedIn
- `rw_organization_admin` — accéder aux pages que vous administrez

### 6.5 Vérification de l'app

LinkedIn demande une vérification avant la mise en production :

1. Pour développement : l'app est en "Development mode" → testable par vous seul
2. Pour production : remplir le formulaire "Verification" (URL de la privacy policy, description, etc.)
3. Le passage en "Production" peut prendre 1-5 jours ouvrés

---

## 7. Configuration Stripe (billing)

> Optionnel — seulement si vous activez la facturation SaaS.

### 7.1 Créer un compte Stripe

1. https://dashboard.stripe.com/register
2. Compléter le profil business

### 7.2 Créer les prix (4 plans × 2 intervalles = 8 prix)

Dans Stripe → "Products" → "Add product" pour chaque combinaison :

| Plan | Prix mensuel | Prix annuel |
|------|-------------|-------------|
| Free | $0 | $0 |
| Pro | $49/mo | $470/an (2 mois gratuits) |
| Business | $149/mo | $1,430/an |
| Enterprise | $499/mo | $4,790/an |

Pour chaque prix, copier le **Price ID** (`price_xxx`) et l'ajouter à Render :

| Variable | Valeur |
|----------|--------|
| `STRIPE_SECRET_KEY` | `sk_live_xxx` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxx` (voir 7.3) |
| `STRIPE_PRICE_PRO_MONTHLY` | `price_xxx` |
| `STRIPE_PRICE_PRO_YEARLY` | `price_xxx` |
| `STRIPE_PRICE_BUSINESS_MONTHLY` | `price_xxx` |
| `STRIPE_PRICE_BUSINESS_YEARLY` | `price_xxx` |
| `STRIPE_PRICE_ENTERPRISE_MONTHLY` | `price_xxx` |
| `STRIPE_PRICE_ENTERPRISE_YEARLY` | `price_xxx` |

### 7.3 Webhook

1. Stripe → "Developers" → "Webhooks" → "Add endpoint"
2. URL : `https://linkedin-visual-studio.onrender.com/api/billing/webhook`
3. Events à écouter :
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copier le **Signing secret** (`whsec_xxx`) → `STRIPE_WEBHOOK_SECRET` dans Render

---

## 8. Cron Jobs Render

> ⚠️ **Obligatoire** — sans ces cron jobs, les agents ne s'exécutent jamais.

Pour chaque cron job, dans Render → "Cron Jobs" → "Create Cron Job" :

### 8.1 Agents (publication des posts programmés)

| Champ | Valeur |
|------|--------|
| **Name** | `hermes-cron-agents` |
| **Command** | `curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://linkedin-visual-studio.onrender.com/api/cron/agents` |
| **Schedule** | `*/5 * * * *` (toutes les 5 minutes) |
| **Plan** | Starter |

### 8.2 Metrics Sync (synchronisation likes/comments)

| Champ | Valeur |
|------|--------|
| **Name** | `hermes-cron-metrics-sync` |
| **Command** | `curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://linkedin-visual-studio.onrender.com/api/cron/metrics-sync` |
| **Schedule** | `0 6 * * *` (tous les jours à 6h UTC) |
| **Plan** | Starter |

### 8.3 Token Refresh (renouvellement tokens LinkedIn)

| Champ | Valeur |
|------|--------|
| **Name** | `hermes-cron-token-refresh` |
| **Command** | `curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://linkedin-visual-studio.onrender.com/api/cron/token-refresh` |
| **Schedule** | `0 4 * * *` (tous les jours à 4h UTC) |
| **Plan** | Starter |

### 8.4 Reactor Capture (capture des likes/comments → CRM)

| Champ | Valeur |
|------|--------|
| **Name** | `hermes-cron-reactor-capture` |
| **Command** | `curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://linkedin-visual-studio.onrender.com/api/cron/reactor-capture` |
| **Schedule** | `0 9,21 * * *` (2×/jour : 9h et 21h UTC) |
| **Plan** | Starter |

### 8.5 Trending Detect (détection des sujets tendance)

| Champ | Valeur |
|------|--------|
| **Name** | `hermes-cron-trending-detect` |
| **Command** | `curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://linkedin-visual-studio.onrender.com/api/cron/trending-detect` |
| **Schedule** | `0 8,14,20 * * *` (3×/jour) |
| **Plan** | Starter |

### 8.6 Trending Engage (auto-reply aux tendances)

| Champ | Valeur |
|------|--------|
| **Name** | `hermes-cron-trending-engage` |
| **Command** | `curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://linkedin-visual-studio.onrender.com/api/cron/trending-engage` |
| **Schedule** | `30 8,14,20 * * *` (3×/jour, 30 min après la détection) |
| **Plan** | Starter |

### 8.7 Integrations Sync (sync CRM externes — HubSpot, Pipedrive, etc.)

| Champ | Valeur |
|------|--------|
| **Name** | `hermes-cron-integrations-sync` |
| **Command** | `curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://linkedin-visual-studio.onrender.com/api/cron/integrations-sync` |
| **Schedule** | `0 */6 * * *` (toutes les 6 heures) |
| **Plan** | Starter |

---

## 9. Vérification post-déploiement

### 9.1 Checklist de validation

Après le déploiement, exécutez ces vérifications :

```bash
# 1. Health check
curl https://linkedin-visual-studio.onrender.com/api/health
# → {"status":"ok"}

# 2. Schema des tables d'engagement
curl https://linkedin-visual-studio.onrender.com/api/setup/ensure-engagement-tables
# → {"ok":true, "tables":{"missing":[]}, ...}

# 3. Login (avec compte démo)
# Email: demo@hermes.app
# Mot de passe: Demo-Hermes-2024
# → connexion réussie, redirect sur dashboard

# 4. Connecter LinkedIn (bouton "Connecter LinkedIn" dans la sidebar)
# → OAuth flow se termine sur /?linkedin=connected

# 5. Tester la génération d'un post (vue Agent Contenu)
# → clique sur "Générer un post"
# → vérifier qu'un post est généré via Groq

# 6. Tester la capture de réacteurs (vue Engagement IA → Réacteurs)
# → si vous avez des posts LinkedIn existants, vous devriez voir les likers

# 7. Tester les commentaires experts (vue Engagement IA → Tendances → Ajouter un sujet → Générer commentaire)
# → 3 variantes de commentaires s'affichent
```

### 9.2 Vérifier les cron jobs

Après 1 heure, dans Render → chaque cron job devrait montrer "Last run: succeeded".

Si un cron échoue, vérifier :
- Que `$CRON_SECRET` est bien défini dans les env vars du cron job
- Que l'URL est correctement formatée (avec `https://`)
- Les logs du cron job pour le détail de l'erreur

---

## 10. Dépannage

### 10.1 Erreur 500 sur `/api/data/reactors` etc.

**Cause probable** : les tables d'engagement n'existent pas en base.

**Solution** :
```bash
curl https://linkedin-visual-studio.onrender.com/api/setup/ensure-engagement-tables
```
Si ça échoue, vérifier que `DATABASE_URL` est bien défini dans Render.

### 10.2 Erreur React #418 (hydration mismatch)

**Cause probable** : cache du navigateur avec une ancienne version du bundle.

**Solution** :
1. Hard refresh : `Cmd+Shift+R` (Mac) ou `Ctrl+Shift+R` (Windows/Linux)
2. Vider le cache : DevTools → Application → Storage → Clear site data
3. Si persistant, vérifier que la version déployée correspond au dernier commit

### 10.3 LinkedIn OAuth : "redirect_uri mismatch"

**Cause** : l'URL de callback dans LinkedIn Developer ne correspond pas à l'URL Render.

**Solution** :
- Dans LinkedIn Developer → "Auth" tab → "Authorized redirect URLs"
- Vérifier que c'est exactement : `https://linkedin-visual-studio.onrender.com/api/linkedin/callback`
- Pas de slash final, pas de http:// (HTTPS uniquement)

### 10.4 NextAuth : "Authentication required" sur toutes les routes API

**Cause probable** : session non établie.

**Solution** :
1. Se connecter via la sidebar (bouton "Se connecter")
2. Utiliser `demo@hermes.app` / `Demo-Hermes-2024` pour tester
3. Si le compte démo n'existe pas, c'est que la migration User n'a pas tourné — exécuter `curl https://linkedin-visual-studio.onrender.com/api/setup/ensure-user-columns`

### 10.5 Token LinkedIn expiré

**Cause** : tokens LinkedIn valables 60 jours, refresh automatique uniquement si ≤7 jours restants.

**Solution** :
1. Le cron `token-refresh` tourne à 4h UTC chaque jour
2. Si le token a expiré avant le refresh, l'utilisateur doit reconnecter LinkedIn manuellement (bouton "Connecter LinkedIn")
3. Vérifier les logs du cron `token-refresh` pour confirmer qu'il s'exécute

### 10.6 Cron jobs ne s'exécutent pas

**Cause probable** : `$CRON_SECRET` non échappé correctement dans la commande.

**Solution** :
- Render interprète `$CRON_SECRET` dans la commande cron
- Vérifier que `CRON_SECRET` est bien défini dans les env vars du cron job (pas juste du web service)
- Tester manuellement : `curl -X POST -H "x-cron-secret: VOTRE_SECRET" https://linkedin-visual-studio.onrender.com/api/cron/agents`

### 10.7 "Database connection error"

**Cause probable** : `DATABASE_URL` mal formatée ou base Neon en pause.

**Solution** :
1. Vérifier le format : `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/hermes?sslmode=require`
2. Neon free tier : la base se met en pause après 5 min d'inactivité. Le premier appel peut prendre 1-2 secondes pour réveiller la base.
3. Si persistant, tester la connexion depuis Render shell : `npx prisma db pull --print | head -5`

### 10.8 Build échoue sur Render

**Cause probable** : erreur TypeScript ou version Node inadéquate.

**Solution** :
1. Vérifier les logs de build Render
2. Localement : `npx tsc --noEmit` (devrait afficher 0 erreur)
3. Localement : `npx next build` (devrait réussir)
4. Si OK localement mais pas sur Render, vérifier la version Node :
   - Render → Settings → "Environment" → `NODE_VERSION=22`

---

## 📞 Support

- **Repo** : https://github.com/skaba89/linkedin-visual-studio
- **Logs Render** : https://dashboard.render.com → votre service → "Logs"
- **Logs Neon** : https://console.neon.tech → votre projet → "SQL Editor" pour inspecter les tables

---

## ✅ Checklist finale

Avant de considérer HERMÈS "en production" :

- [ ] Web Service déployé sur Render (status: live)
- [ ] Health check `/api/health` retourne `{"status":"ok"}`
- [ ] `/api/setup/ensure-engagement-tables` retourne `{"ok":true}`
- [ ] Login avec `demo@hermes.app` fonctionne
- [ ] LinkedIn OAuth fonctionne (callback `/api/linkedin/callback`)
- [ ] Au moins 1 cron job créé et exécuté avec succès
- [ ] `NEXTAUTH_SECRET` généré (pas la valeur par défaut)
- [ ] `ENCRYPTION_KEY` généré (pas la valeur par défaut)
- [ ] `CRON_SECRET` généré et partagé entre web service et cron jobs
- [ ] LinkedIn app en mode "Production" (ou en "Development" pour test seul)
- [ ] (Optionnel) Stripe configuré avec 8 prix + webhook
- [ ] (Optionnel) Domaine personnalisé configuré dans Render

Une fois tous ces points validés, HERMÈS est prêt pour vos premiers utilisateurs payants.
