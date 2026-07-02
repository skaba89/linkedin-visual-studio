/**
 * HERMÈS — Phase 4.3 — Integration provider definitions
 *
 * Defines the supported external CRM/automation integrations and their
 * metadata (display name, icon, auth fields, docs URL).
 *
 * Each provider has:
 *   - id:           unique identifier (matches Integration.provider column)
 *   - name:         display name
 *   - description:  short marketing copy
 *   - authFields:   array of fields the user must fill in to authenticate
 *   - docsUrl:      link to the provider's docs (how to get API key)
 *   - color:        brand color for the icon
 *   - icon:         emoji or short label (UI uses Lucide icons separately)
 *
 * Supported providers:
 *   - hubspot:    HubSpot CRM (API key or OAuth)
 *   - pipedrive:  Pipedrive CRM (API key)
 *   - notion:     Notion databases (API key + database ID)
 *   - attio:      Attio CRM (API key)
 *   - salesforce: Salesforce CRM (OAuth — coming soon)
 */

export type ProviderId = "hubspot" | "pipedrive" | "notion" | "attio" | "salesforce";

export interface AuthField {
  id: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder: string;
  required: boolean;
  helpText?: string;
}

export interface IntegrationProvider {
  id: ProviderId;
  name: string;
  description: string;
  authFields: AuthField[];
  docsUrl: string;
  color: string;
  features: string[];
}

export const PROVIDERS: Record<ProviderId, IntegrationProvider> = {
  hubspot: {
    id: "hubspot",
    name: "HubSpot",
    description: "Synchronisez vos contacts et deals vers HubSpot CRM",
    authFields: [
      {
        id: "apiKey",
        label: "Clé API HubSpot",
        type: "password",
        placeholder: "pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        required: true,
        helpText: "Créez une clé privée dans HubSpot → Paramètres → Intégrations → Clés privées",
      },
      {
        id: "ownerId",
        label: "Owner ID (optionnel)",
        type: "text",
        placeholder: "12345678",
        required: false,
        helpText: "ID du propriétaire HubSpot à assigner aux contacts synchronisés",
      },
    ],
    docsUrl: "https://developers.hubspot.com/docs/api/private-apps",
    color: "#FF7A59",
    features: [
      "Sync contacts bidirectionnel",
      "Création automatique de deals",
      "Mapping de pipelines personnalisable",
      "Synchronisation des activités LinkedIn",
    ],
  },
  pipedrive: {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Poussez vos leads HERMÈS dans votre pipeline Pipedrive",
    authFields: [
      {
        id: "apiKey",
        label: "Clé API Pipedrive",
        type: "password",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        required: true,
        helpText: "Trouvez votre clé API dans Pipedrive → Paramètres → Advanced → API",
      },
      {
        id: "companyDomain",
        label: "Domaine société",
        type: "text",
        placeholder: "mon-entreprise",
        required: true,
        helpText: "Le sous-domaine de votre Pipedrive (avant .pipedrive.com)",
      },
    ],
    docsUrl: "https://pipedrive.readme.io/docs",
    color: "#1A1A1A",
    features: [
      "Création de personnes et organisations",
      "Ajout de deals dans le pipeline",
      "Synchronisation des notes LinkedIn",
      "Mapping de stages personnalisable",
    ],
  },
  notion: {
    id: "notion",
    name: "Notion",
    description: "Exportez vos contacts dans une base de données Notion",
    authFields: [
      {
        id: "apiKey",
        label: "Token d'intégration Notion",
        type: "password",
        placeholder: "secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        required: true,
        helpText: "Créez une intégration sur notion.so/my-integrations et partagez la base avec elle",
      },
      {
        id: "databaseId",
        label: "ID de la base de données",
        type: "text",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        required: true,
        helpText: "L'ID de la base Notion (visible dans l'URL de la base)",
      },
    ],
    docsUrl: "https://developers.notion.com/docs",
    color: "#000000",
    features: [
      "Création d'entrées dans une base Notion",
      "Mapping de propriétés personnalisable",
      "Synchronisation des notes et tags",
      "Mise à jour des entrées existantes (dédup par LinkedIn URL)",
    ],
  },
  attio: {
    id: "attio",
    name: "Attio",
    description: "Synchronisez vos contacts vers Attio CRM",
    authFields: [
      {
        id: "apiKey",
        label: "Clé API Attio",
        type: "password",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxx",
        required: true,
        helpText: "Générez une clé API dans Attio → Paramètres → API",
      },
      {
        id: "listId",
        label: "ID de liste (optionnel)",
        type: "text",
        placeholder: "list_xxxxxxxx",
        required: false,
        helpText: "ID de la liste Attio où ajouter les contacts synchronisés",
      },
    ],
    docsUrl: "https://docs.attio.com/docs",
    color: "#7C3AED",
    features: [
      "Création de records dans Attio",
      "Ajout à une liste spécifique",
      "Synchronisation des attributs personnalisés",
      "Déduplication par email",
    ],
  },
  salesforce: {
    id: "salesforce",
    name: "Salesforce",
    description: "Bientôt disponible — Synchronisation vers Salesforce CRM",
    authFields: [],
    docsUrl: "https://developer.salesforce.com/docs/",
    color: "#00A1E0",
    features: [
      "OAuth 2.0 (à venir)",
      "Sync leads et opportunities",
      "Mapping de champs personnalisé",
    ],
  },
};

export const PROVIDER_LIST: IntegrationProvider[] = Object.values(PROVIDERS);

export function getProvider(id: string): IntegrationProvider | null {
  return PROVIDERS[id as ProviderId] ?? null;
}
