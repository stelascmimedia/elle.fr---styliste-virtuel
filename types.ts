export type Gender = 'femme';
export type Usage = 'quotidien' | 'travail' | 'soiree' | 'week-end';
export type Style = 'minimal' | 'chic' | 'sporty' | 'boheme' | 'casual' | 'rock';
export type Temperature = 'froid' | 'tempere' | 'chaud';
export type Rain = 'oui' | 'non';
export type Fit = 'ajuste' | 'droit' | 'oversize';
export type Slot = 'outerwear' | 'top' | 'bottom' | 'shoes' | 'accessory';

export interface UserProfile {
  sex: Gender;
  age: number;
  usage: Usage;
  style: Style;
  temperature: Temperature;
  rain: Rain;
  budget: number;
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
  weatherTags: Temperature[];
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
