
import { Product } from '../types';

export const CATALOG: Product[] = [
  // Femme - Smart Chic - Froid
  {
    id: 'f1',
    title: 'Manteau en laine structuré',
    brand: 'Maje',
    image: 'https://picsum.photos/seed/manteau1/400/600',
    affiliateUrl: 'https://elle.fr/shopping/manteau-maje',
    price: 345,
    currency: 'EUR',
    category: 'Woman > Coat',
    slot: 'outerwear',
    styleTags: ['smart chic', 'business'],
    colorHex: '#333333',
    weatherTags: ['froid', 'pluvieux']
  },
  {
    id: 'f2',
    title: 'Pull Cachemire Col Roulé',
    brand: 'Sandro',
    image: 'https://picsum.photos/seed/pull1/400/600',
    affiliateUrl: 'https://elle.fr/shopping/pull-sandro',
    price: 185,
    currency: 'EUR',
    category: 'Woman > Knitwear',
    slot: 'top',
    styleTags: ['smart chic', 'décontracté'],
    colorHex: '#F5F5DC',
    weatherTags: ['froid', 'normal']
  },
  {
    id: 'f3',
    title: 'Pantalon Large Taille Haute',
    brand: 'Claudie Pierlot',
    image: 'https://picsum.photos/seed/pantalon1/400/600',
    affiliateUrl: 'https://elle.fr/shopping/pantalon-cp',
    price: 165,
    currency: 'EUR',
    category: 'Woman > Trousers',
    slot: 'bottom',
    styleTags: ['business', 'smart chic'],
    colorHex: '#000000',
    weatherTags: ['froid', 'normal', 'pluvieux', 'chaud']
  },
  {
    id: 'f4',
    title: 'Bottines en cuir noir',
    brand: 'Jonak',
    image: 'https://picsum.photos/seed/shoes1/400/600',
    affiliateUrl: 'https://elle.fr/shopping/bottines-jonak',
    price: 145,
    currency: 'EUR',
    category: 'Woman > Shoes',
    slot: 'shoes',
    styleTags: ['smart chic', 'business', 'habillé'],
    colorHex: '#000000',
    weatherTags: ['froid', 'normal', 'pluvieux']
  },
  // Décontracté - Chaud
  {
    id: 'f5',
    title: 'Robe d\'été à fleurs',
    brand: 'Ba&sh',
    image: 'https://picsum.photos/seed/robe1/400/600',
    affiliateUrl: 'https://elle.fr/shopping/robe-bash',
    price: 220,
    currency: 'EUR',
    category: 'Woman > Dress',
    slot: 'top',
    styleTags: ['décontracté'],
    colorHex: '#FFB6C1',
    weatherTags: ['chaud']
  },
  {
    id: 'f6',
    title: 'Sandales en cuir doré',
    brand: 'K.Jacques',
    image: 'https://picsum.photos/seed/sandales1/400/600',
    affiliateUrl: 'https://elle.fr/shopping/sandales-kj',
    price: 195,
    currency: 'EUR',
    category: 'Woman > Shoes',
    slot: 'shoes',
    styleTags: ['décontracté', 'habillé'],
    colorHex: '#FFD700',
    weatherTags: ['chaud']
  },
  // Homme
  {
    id: 'h1',
    title: 'Blazer en flanelle',
    brand: 'De Fursac',
    image: 'https://picsum.photos/seed/blazer-h/400/600',
    affiliateUrl: 'https://elle.fr/shopping/blazer-fursac',
    price: 495,
    currency: 'EUR',
    category: 'Man > Blazer',
    slot: 'top',
    styleTags: ['business', 'smart chic'],
    colorHex: '#2F4F4F',
    weatherTags: ['normal', 'froid']
  }
];
