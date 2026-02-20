
import { Weather, Slot } from './types';

export const MATCHING_CONFIG = {
  budgetTolerancePct: 0.15,
  meteoToSlots: {
    froid: ['outerwear', 'top', 'bottom', 'shoes'] as Slot[],
    normal: ['top', 'bottom', 'shoes'] as Slot[],
    pluvieux: ['outerwear', 'top', 'bottom', 'shoes'] as Slot[],
    chaud: ['top', 'bottom', 'shoes'] as Slot[],
  },
  weights: {
    style: 10,
    color: 5,
    audace: 3,
  }
};

export const LOOK_VARIATION_INSTRUCTIONS: Record<number, string> = {
  0: 'Look 0: prioriser un rendu classique, sobre et polyvalent.',
  1: 'Look 1: proposer une tenue plus coloree, tout en restant portable au quotidien.',
  2: 'Look 2: proposer une tenue plus audacieuse, avec des associations plus affirmees.',
  3: 'Look 3: proposer une tenue plus casual et detendue.',
  4: 'Look 4: proposer une tenue plus habillee et elegante.',
};

export const PROMPT_TEMPLATE = `

Générer une photo ultra photoréaliste de type streetstyle (comme une photo prise lors de la Fashion Week), en plein pied (de la tête aux pieds, chaussures visibles), montrant un/une {SEXE} portant exactement les vêtements visibles dans les images de référence fournies en input.
Respect absolu des vêtements de référence : reproduire fidèlement la coupe, les couleurs, les matières, les motifs, les coutures, la longueur, les détails (boutons, fermetures, poches) et la manière dont ils tombent sur le corps. Ne pas inventer d’autres vêtements et ne pas modifier le design (pas de changement de couleur, pas d’ajout de logo).


SUJET
Silhouette mode, proportions réalistes
Plein pied strict : tête et pieds entièrement visibles, chaussures visibles

VÊTEMENTS (CONTRAINTE PRIORITAIRE)
Porter EXACTEMENT et UNIQUEMENT tous les vêtements suivants décrits :
{CLOTHING_DESCRIPTION}

REPRODUIRE FIDÈLEMENT : coupe, matières, couleurs, motifs, textures, coutures, longueurs et détails. Aucune modification.

CONTEXTE CLIENT
Âge : {AGE} ans
Style : {STYLE}
Météo : {WEATHER}
Audace : {AUDACITY}
SEXE : {SEXE}

CHEVEUX
Naturels et crédibles

POSE
Streetstyle authentique, posture confiante

DÉCOR
Rue parisienne sobre, minimaliste, sans foule

LUMIÈRE
Naturelle extérieure, peau réaliste, pas d'effet plastique

CADRAGE
Photo verticale, plein pied centré, profondeur de champ légère

NEGATIVE PROMPT :
illustration, cartoon, anime, CGI, 3D, rendu plastique, proportions irréalistes, corps déformé, mains déformées, low-res, watermark, logo, texte, foule, studio, vêtements inventés, changement de couleur, cropped feet, cut off head, half body
`;
