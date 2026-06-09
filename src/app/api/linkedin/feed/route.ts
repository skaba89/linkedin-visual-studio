import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookies } from "@/lib/linkedin-token";

export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromCookies();

    if (!token) {
      return NextResponse.json(
        { error: "Non authentifié. Connectez votre compte LinkedIn." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const linkedinId = searchParams.get("linkedinId");

    if (!linkedinId) {
      return NextResponse.json(
        { error: "L'ID LinkedIn est requis" },
        { status: 400 }
      );
    }

    // Try to fetch from LinkedIn API
    const ownerUrn = `urn:li:person:${linkedinId}`;
    const feedUrl = `https://api.linkedin.com/v2/shares?q=owners&owners=${encodeURIComponent(ownerUrn)}&count=10`;

    const feedResponse = await fetch(feedUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!feedResponse.ok) {
      const errorText = await feedResponse.text();
      console.error("LinkedIn feed fetch failed:", feedResponse.status, errorText);

      // Return simulated feed data for demo purposes
      return NextResponse.json({
        simulated: true,
        message: "L'API LinkedIn Feed nécessite un accès Marketing Developer Platform. Affichage du mode aperçu.",
        posts: getSimulatedFeed(),
      });
    }

    const feedData = await feedResponse.json();
    const posts = (feedData.elements || []).map((share: Record<string, unknown>) => ({
      id: share.id || share.updateKey || String(Math.random()),
      text: share.commentary || share.text?.text || "",
      author: share.owner || "",
      createdAt: share.created?.time || new Date().toISOString(),
      likes: 0,
      comments: 0,
      visibility: share.visibility?.code || "PUBLIC",
    }));

    return NextResponse.json({
      simulated: false,
      posts,
    });
  } catch (error) {
    console.error("LinkedIn feed error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

/**
 * Generate simulated French B2B LinkedIn posts for demo/preview mode
 */
function getSimulatedFeed() {
  return [
    {
      id: "sim-1",
      text: `Le saviez-vous ? 78% des décideurs B2B préfèrent être contactés par un pair plutôt que par un commercial.

C'est exactement pourquoi les agents IA changent la donne en matière de prospection :

→ Ils identifient les signaux d'achat en temps réel
→ Ils personnalisent chaque premier message à partir du contexte
→ Ils maintiennent le suivi sans que vous n'ayez à y penser

Le résultat ? Un taux de réponse 3x supérieur aux séquences traditionnelles.

Qui utilise déjà l'IA dans sa prospection ? 👇`,
      author: "Sophie Martin",
      authorRole: "CEO @ AutomatePro",
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      likes: 142,
      comments: 23,
      visibility: "PUBLIC",
    },
    {
      id: "sim-2",
      text: `J'ai automatisé 100% de ma prospection LinkedIn en 30 jours.

Voici ce qui a changé :

📊 156 profils qualifiés / semaine (vs 12 avant)
📧 28 messages personnalisés / jour (vs 5)
🎯 8 RDV générés / semaine (vs 2)

Le secret ? 3 agents IA qui travaillent 24/7 :
1️⃣ Agent Contenu → publie chaque matin
2️⃣ Agent Qualification → collecte et score les leads
3️⃣ Agent Prospection → envoie les messages et gère les relances

Le tout sans un seul cold call.

Détail du setup en commentaire 👇`,
      author: "Thomas Dubois",
      authorRole: "Head of Growth @ ScaleUp",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      likes: 287,
      comments: 45,
      visibility: "PUBLIC",
    },
    {
      id: "sim-3",
      text: `Le scoring ICP, c'est pas un buzzword. C'est du math.

Score = (Titre match × 30) + (Secteur match × 20) + (Taille entreprise × 20) + (Engagement × 15) + (Connexion 1er degré × 15)

Un prospect à 80+ ? Vous le contactez en priorité.
Un prospect à 40- ? Vous l'archivez automatiquement.

Résultat : 60% de temps gagné sur la qualification manuelle.

Combien de temps passez-vous à qualifier vos leads manuellement ?`,
      author: "Léa Chen",
      authorRole: "Directrice Marketing @ DataPulse",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      likes: 94,
      comments: 12,
      visibility: "PUBLIC",
    },
    {
      id: "sim-4",
      text: `Stop aux messages LinkedIn copiés-collés.

"Bonjour, je me permets de vous contacter car..."

Non. Arrêtez. Sérieusement.

La bonne approche :
✅ Référencez une action précise (un post, un commentaire)
✅ Ajoutez UNE valeur spécifique à leur secteur
✅ Posez UNE question ouverte

80 mots max. Pas de pitch. Pas de lien Calendly.

Le but du 1er message ? Obtenir une réponse. Pas un RDV.

Qui est d'accord ? 🤝`,
      author: "Pierre Lefèvre",
      authorRole: "Co-fondateur @ GrowthLab",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      likes: 312,
      comments: 67,
      visibility: "PUBLIC",
    },
    {
      id: "sim-5",
      text: `L'IA ne remplace pas les commerciaux.

Elle leur redonne du temps.

Temps pour les conversations qui comptent vraiment.
Temps pour les négos complexes.
Temps pour la stratégie au lieu du data entry.

Le commercial de demain ? Un chef d'orchestre d'agents IA.

Pas un exécutant de tâches répétitives.

Votre avis ? L'IA va-t-elle renforcer ou affaiblir le rôle commercial ?`,
      author: "Camille Rousseau",
      authorRole: "VP Sales @ CloudPeak",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      likes: 198,
      comments: 34,
      visibility: "PUBLIC",
    },
    {
      id: "sim-6",
      text: `Thread 🧵 : Comment j'ai construit mon système de prospection LinkedIn automatisé

1/ Setup : HERMÈS Dashboard + 3 agents IA
- Agent Contenu : publie 5x/semaine à 8h
- Agent Qualification : scan les interactions toutes les 4h  
- Agent Prospection : envoie les messages toutes les 2h

2/ Résultats après 30 jours :
- 156 profils collectés
- 34 leads qualifiés (score ≥ 60)
- 28 messages envoyés
- 8 RDVs générés

3/ Le secret : la boucle de rétroaction
Chaque action alimente la suivante. Le contenu attire → les interactions qualifient → la prospection convertit.

Détails techniques dans le thread 👇`,
      author: "Antoine Mercier",
      authorRole: "Fondateur @ NexaConsulting",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
      likes: 421,
      comments: 89,
      visibility: "PUBLIC",
    },
  ];
}
