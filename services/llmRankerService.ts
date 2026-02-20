import { GoogleGenAI } from '@google/genai';
import { Slot, UserProfile } from '../types';

export interface RankedOutfitItem {
  slot: Slot;
  id: string;
  reason: string[];
}

export interface RankedOutfit {
  outfit: RankedOutfitItem[];
  totalPrice: number;
  notes: string[];
}

type Candidate = {
  id: string;
  title: string;
  description?: string;
  brand: string;
  price: number;
  currency: string;
  category: string;
  affiliateUrl: string;
  image: string;
  availability?: string;
};

function extractResponseText(response: any): string {
  if (typeof response?.text === 'string') return response.text;

  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const textPart = parts.find((part: any) => typeof part?.text === 'string');
    if (textPart?.text) return textPart.text;
  }

  return '';
}

function buildVariationInstruction(lookIndex?: number, variationInstruction?: string): string {
  if (variationInstruction) return variationInstruction;
  if (typeof lookIndex !== 'number') return '';

  const defaultMap: Record<number, string> = {
    0: 'Version classique et sobre.',
    1: 'Version plus coloree.',
    2: 'Version plus audacieuse.',
    3: 'Version plus casual.',
    4: 'Version plus habillee.',
  };

  return defaultMap[lookIndex] || '';
}

export async function rankOutfitWithLLM(args: {
  profile: UserProfile;
  requiredSlots: Slot[];
  candidatesBySlot: Record<Slot, Candidate[]>;
  lookIndex?: number;
  variationInstruction?: string;
}): Promise<RankedOutfit> {
  const { profile, requiredSlots, candidatesBySlot, lookIndex, variationInstruction } = args;
  const toleranceBudget = Number((profile.budget * 1.05).toFixed(2));
  const variation = buildVariationInstruction(lookIndex, variationInstruction);

  const allowedIds: Record<string, string[]> = {};
  for (const slot of requiredSlots) {
    allowedIds[slot] = candidatesBySlot[slot].map((candidate) => candidate.id);
  }

  const shortlistPayload = requiredSlots.reduce<Record<string, Candidate[]>>((acc, slot) => {
    acc[slot] = candidatesBySlot[slot];
    return acc;
  }, {});

  const prompt = `
Tu es un styliste + moteur de ranking.
Ta mission: choisir exactement 1 produit par slot dans requiredSlots, uniquement parmi les candidats fournis.

CONTRAINTES DURES:
- N'utiliser QUE les ids fournis dans allowedIdsBySlot.
- 1 seul produit par slot obligatoire.
- Le total doit etre <= budgetMax (tolerance incluse).
- Exclure les produits enfant (category contient Girl/Boy ou title/description contient "Enfant").
- Si sex=femme, privilegier les categories Woman.
- Si sex=homme, privilegier les categories Man.
- Ne jamais inventer d'id, de slot, de produit, de prix.

OBJECTIFS SOFT:
- Respect du style, meteo, audace, preference couleur, coherence globale.
- Eviter 2 motifs forts quand audace=faible.
- ${variation || 'Version neutre.'}

PROFILE:
${JSON.stringify(profile)}

requiredSlots:
${JSON.stringify(requiredSlots)}

budgetMax:
${toleranceBudget}

allowedIdsBySlot:
${JSON.stringify(allowedIds)}

candidatesBySlot:
${JSON.stringify(shortlistPayload)}

RETOUR STRICT JSON (aucun texte autour):
{
  "outfit":[{"slot":"outerwear","id":"...","reason":["..."]}],
  "totalPrice": 0,
  "notes": ["..."]
}
`;

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  });

  const raw = extractResponseText(response).trim();
  const parsed = JSON.parse(raw) as RankedOutfit;

  if (!Array.isArray(parsed.outfit) || !Array.isArray(parsed.notes)) {
    throw new Error('LLM ranker JSON invalide: structure manquante');
  }

  return parsed;
}
