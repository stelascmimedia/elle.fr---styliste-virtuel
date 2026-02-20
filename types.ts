
export type Gender = 'homme' | 'femme';
export type Style = 'décontracté' | 'smart chic' | 'business' | 'habillé';
export type Weather = 'froid' | 'normal' | 'pluvieux' | 'chaud';
export type Audacity = 'faible' | 'moyen' | 'élevé';
export type Fit = 'ajustée' | 'ample';
export type Slot = 'outerwear' | 'top' | 'bottom' | 'shoes' | 'accessory';

export interface UserProfile {
  sex: Gender;
  age: number;
  style: Style;
  season_meteo: Weather;
  budget: number;
  audace: Audacity;
  colorPreference: string;
  fitPreference: Fit;
}

export interface Product {
  id: string;
  title: string;
  brand: string;
  image: string;
  affiliateUrl: string;
  price: number;
  currency: string;
  category: string;
  slot: Slot;
  styleTags: Style[];
  colorHex: string;
  weatherTags: Weather[];
}

export interface LookVariant {
  imageUrl: string;
  outfit: Product[];
  totalPrice: number;
}

export interface GeneratedLook extends LookVariant {
  alternatives: LookVariant[];
  debug?: any;
}
