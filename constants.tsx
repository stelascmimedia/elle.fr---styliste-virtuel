import { Temperature, Slot } from './types';

export const MATCHING_CONFIG = {
  budgetTolerancePct: 0.15,
  temperatureToSlots: {
    froid: ['outerwear', 'top', 'bottom', 'shoes'] as Slot[],
    tempere: ['top', 'bottom', 'shoes'] as Slot[],
    chaud: ['top', 'bottom', 'shoes'] as Slot[],
  } as Record<Temperature, Slot[]>,
  weights: {
    style: 10,
    usage: 6,
    fit: 4,
  },
};

export const LOOK_VARIATION_INSTRUCTIONS: Record<number, string> = {
  0: 'Look 0: prioriser un rendu classique, sobre et polyvalent.',
  1: 'Look 1: proposer une tenue plus coloree, tout en restant portable au quotidien.',
  2: 'Look 2: proposer une tenue plus affirmee et contrastee.',
  3: 'Look 3: proposer une tenue plus detendue et casual.',
  4: 'Look 4: proposer une tenue plus habillee et elegante.',
};

export const PROMPT_TEMPLATE = `
Generer une photo ultra photorealiste de type streetstyle, en plein pied (de la tete aux pieds, chaussures visibles), montrant une femme portant exactement les vetements visibles dans les images de reference fournies en input.
Respect absolu des vetements de reference : reproduire fidelement la coupe, les couleurs, les matieres, les motifs, les coutures, la longueur, les details (boutons, fermetures, poches) et la maniere dont ils tombent sur le corps.

SUJET
Silhouette mode, proportions realistes
Plein pied strict : tete et pieds entierement visibles, chaussures visibles

VETEMENTS (CONTRAINTE PRIORITAIRE)
Porter EXACTEMENT et UNIQUEMENT tous les vetements suivants decrits :
{CLOTHING_DESCRIPTION}

REPRODUIRE FIDELEMENT : coupe, matieres, couleurs, motifs, textures, coutures, longueurs et details. Aucune modification.

CONTEXTE CLIENT
Age : {AGE} ans
Usage : {USAGE}
Style : {STYLE}
Temperature : {TEMPERATURE}
Pluie : {RAIN}
Coupe souhaitee : {FIT}

CHEVEUX
Naturels et credibles

POSE
Streetstyle authentique, posture confiante

DECOR
Rue parisienne sobre, minimaliste, sans foule

LUMIERE
Naturelle exterieure, peau realiste, pas d'effet plastique

CADRAGE
Photo verticale, plein pied centre, profondeur de champ legere

NEGATIVE PROMPT :
illustration, cartoon, anime, CGI, 3D, rendu plastique, proportions irrealistes, corps deforme, mains deformees, low-res, watermark, logo, texte, foule, studio, vetements inventes, changement de couleur, cropped feet, cut off head, half body
`;
