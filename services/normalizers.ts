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

function categoryToSlot(category: string): Slot {
  const text = category.toLowerCase();

  if (/(coat|manteau|jacket|trench|blazer)/i.test(text)) return 'outerwear';
  if (/(pullover|sweater|cardigan|t-shirt|shirt|top|blouse)/i.test(text)) return 'top';
  if (/(trousers|pants|denim trousers|jean|jeans|skirt|short|bermuda)/i.test(text)) return 'bottom';
  if (/(shoes|sneakers|boot|ballerinas|ballerine|heels|loafers|mocassins)/i.test(text)) return 'shoes';
  return 'top';
}

export function normalizeSimplifiedTdItem(item: SimplifiedTdItem): Product {
  const title = item.title || item.name || 'Produit sans titre';
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
    slot: categoryToSlot(category),
    styleTags: ['décontracté'],
    colorHex: '#000000',
    weatherTags: ['normal'],
  };
}
