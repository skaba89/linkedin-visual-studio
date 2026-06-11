import ZAI from 'z-ai-web-dev-sdk';

async function main() {
  const zai = await ZAI.create();
  
  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `Tu es un expert en contenu LinkedIn viral spécialisé dans la data architecture et l'ingénierie data. Tu écris des posts qui génèrent des milliers d'impressions. Règles absolues:
- Commence par un HOOK puissant qui force le "voir plus" (ligne 1 = la plus importante)
- Utilise le format: HOOK → CONSTAT → SOLUTION → RÉSULTAT → CTA
- Écris en français, ton direct et factuel, pas de jargon inutile
- Paragraphes courts (2-3 lignes max)
- Utilise des chiffres concrets et des exemples réels
- Inclus 3-5 hashtags pertinents en fin de post
- Longueur: 180-250 mots
- Pas d'émojis excessifs (2-3 max)
- Le post doit parler d'un cas réel/constat business concret sur la data architecture`
      },
      {
        role: "user",
        content: "Écris un post LinkedIn sur la data architecture qui attire l'attention et génère des impressions. Le post doit parler d'un vrai problème que les entreprises rencontrent avec leur architecture data et montrer une solution concrète. Le ton doit être celui d'un praticien qui a vu les deux côtés (le chaos et la solution)."
      }
    ],
    temperature: 0.8,
    max_tokens: 600,
  });

  console.log(completion.choices[0]?.message?.content);
}

main().catch(console.error);
