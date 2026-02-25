import { Product, Slot } from '../types';

interface SimplifiedTdItem {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  brand?: string;
  image?: string;
  affiliateUrl?: string;
  price?: number | string;
  currency?: string;
  category?: string;
}

function tinyHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return `p_${(hash >>> 0).toString(36)}`;
}

function parsePrice(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function categoryToSlot(category: string, title: string, description: string): Slot {
  const text = `${category} ${title} ${description}`.toLowerCase();

  if (
    /(coat|manteau|abrigo|jacket|chaqueta|veste|trench|blazer|anorak|parka|gabardina|impermeable|doudoune|plumifero)/i.test(
      text,
    )
  ) {
    return 'outerwear';
  }
  if (
    /(pullover|sweater|jersey|cardigan|t-shirt|camiseta|shirt|chemise|top|blouse|blusa|sudadera|hoodie|sweat|camisa|polo|tank|debardeur|tricot|maille|knitwear)/i.test(
      text,
    )
  ) {
    return 'top';
  }
  if (
    /(trousers|pants|pantalon|pantalones|denim trousers|jean|jeans|skirt|jupe|falda|short|bermuda|leggings|jogger|cargo|chino)/i.test(
      text,
    )
  ) {
    return 'bottom';
  }
  if (
    /(shoes|shoe|sneakers|sneaker|trainers|trainer|footwear|sandals|sandal|boots|boot|ballerinas|ballerine|heels|heel|pumps|escarpins|loafers|mocassins|mocassin|baskets|chaussures|chaussure|calzado|zapato|zapatos|zapatilla|zapatillas|sandalia|sandalias|botin|botines|tacon|tacones|deportiva|deportivas|chancla|chanclas|slippers|mules)/i.test(
      text,
    )
  ) {
    return 'shoes';
  }
  if (/(dress|robe|vestido|mono|combinaison|jumpsuit)/i.test(text)) return 'top';
  return 'top';
}

export function normalizeSimplifiedTdItem(item: SimplifiedTdItem): Product {
  const title = item.title || item.name || 'Produit sans titre';
  const description = item.description || '';
  const brand = item.brand || 'Unknown';
  const category = item.category || '';
  const price = parsePrice(item.price);
  const stableIdSource = `${brand}|${title}|${category}|${price}`;
  const id = item.id || tinyHash(stableIdSource);

  return {
    id,
    title,
    brand,
    image: item.image || '',
    affiliateUrl: item.affiliateUrl || '#',
    price: price > 0 ? price : 0,
    currency: item.currency || 'EUR',
    category: category || 'Unknown',
    slot: categoryToSlot(category, title, description),
    styleTags: ['casual'],
    colorHex: '#000000',
    weatherTags: ['tempere'],
  };
}
