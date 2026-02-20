import { Product, Slot, Weather } from '../types';
import { CATALOG } from './catalog';

interface SourceField {
  name: string;
  value: string;
}

interface SourcePriceHistory {
  price?: {
    value?: string;
    currency?: string;
  };
}

interface SourceOffer {
  id?: string;
  productUrl?: string;
  priceHistory?: SourcePriceHistory[];
}

interface SourceCategory {
  name?: string;
}

interface SourceProductImage {
  url?: string;
}

interface SourceProduct {
  name?: string;
  brand?: string;
  fields?: SourceField[];
  offers?: SourceOffer[];
  categories?: SourceCategory[];
  productImage?: SourceProductImage;
}

interface SourceCatalog {
  products?: SourceProduct[];
}

const MOCK_CATALOG_URL = '/catalogue/catalogue.json';
const DEFAULT_WEATHER: Weather[] = ['froid', 'normal', 'pluvieux', 'chaud'];

export class MockCatalogService {
  static async fetchProducts(): Promise<Product[]> {
    try {
      const response = await fetch(MOCK_CATALOG_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as SourceCatalog;
      const mapped = (payload.products ?? [])
        .map((product, index) => this.mapProduct(product, index))
        .filter((product): product is Product => product !== null);

      if (mapped.length === 0) {
        throw new Error('Aucun produit exploitable dans le JSON mock');
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
      return mapped;
    } catch (error) {
      console.warn('Mock catalog fetch failed, fallback to local catalog.ts', error);
      return CATALOG;
    }
  }

  private static mapProduct(source: SourceProduct, index: number): Product | null {
    const fields = source.fields ?? [];
    const category = source.categories?.[0]?.name || 'Unknown';
    const name = source.name || `Produit ${index + 1}`;

    const price =
      this.getPriceFromField(fields) ??
      this.getPriceFromOffer(source.offers?.[0]) ??
      0;

    if (price <= 0) {
      return null;
    }

    const id =
      this.getFieldValue(fields, 'ProductoID') ||
      this.getFieldValue(fields, 'g:mpn') ||
      source.offers?.[0]?.id ||
      `mock-${index}`;

    const image =
      source.productImage?.url ||
      this.getFieldValue(fields, 'g:additional_image_link') ||
      'https://picsum.photos/seed/mock-catalog/400/600';

    const colorHex = this.mapColorToHex(this.getFieldValue(fields, 'g:color'));
    const slot = this.detectSlot(category, name);

    return {
      id,
      title: name,
      brand: source.brand || 'Unknown',
      image,
      affiliateUrl: source.offers?.[0]?.productUrl || '#',
      price,
      currency: source.offers?.[0]?.priceHistory?.[0]?.price?.currency || 'EUR',
      category,
      slot,
      styleTags: this.detectStyleTags(category, name),
      colorHex,
      weatherTags: this.detectWeatherTags(slot, name, category),
    };
  }

  private static getFieldValue(fields: SourceField[], key: string): string | undefined {
    return fields.find((field) => field.name === key)?.value;
  }

  private static getPriceFromField(fields: SourceField[]): number | null {
    const salePrice = this.getFieldValue(fields, 'Sale price');
    return this.parsePrice(salePrice);
  }

  private static getPriceFromOffer(offer?: SourceOffer): number | null {
    const lastPrice = offer?.priceHistory?.[offer.priceHistory.length - 1]?.price?.value;
    return this.parsePrice(lastPrice);
  }

  private static parsePrice(value?: string): number | null {
    if (!value) {
      return null;
    }

    const normalized = value.replace(',', '.').trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private static detectSlot(category: string, name: string): Slot {
    const text = `${category} ${name}`.toLowerCase();

    if (text.includes('shoe') || text.includes('sandale') || text.includes('bottine') || text.includes('boot')) {
      return 'shoes';
    }
    if (text.includes('coat') || text.includes('manteau') || text.includes('veste') || text.includes('blazer')) {
      return 'outerwear';
    }
    if (text.includes('trouser') || text.includes('pantalon') || text.includes('jean') || text.includes('jupe') || text.includes('short')) {
      return 'bottom';
    }

    return 'top';
  }

  private static detectStyleTags(category: string, name: string): Product['styleTags'] {
    const text = `${category} ${name}`.toLowerCase();

    if (text.includes('blazer') || text.includes('tailor') || text.includes('tailleur')) {
      return ['business', 'smart chic'];
    }
    if (text.includes('robe') || text.includes('dress')) {
      return ['smart chic'];
    }

    return ['smart chic', 'business'];
  }

  private static detectWeatherTags(slot: Slot, name: string, category: string): Weather[] {
    const text = `${name} ${category}`.toLowerCase();

    if (slot === 'outerwear') {
      return ['froid', 'normal', 'pluvieux'];
    }
    if (slot === 'shoes') {
      return ['froid', 'normal', 'pluvieux', 'chaud'];
    }

    if (text.includes('t-shirt') || text.includes('debardeur') || text.includes('sandale') || text.includes('short')) {
      return ['chaud', 'normal'];
    }
    if (text.includes('pull') || text.includes('laine') || text.includes('cachemire')) {
      return ['froid', 'normal'];
    }

    return DEFAULT_WEATHER;
  }

  private static mapColorToHex(colorValue?: string): string {
    if (!colorValue) {
      return '#000000';
    }

    const normalized = colorValue.toLowerCase();
    const colorMap: Record<string, string> = {
      black: '#000000',
      white: '#ffffff',
      blue: '#1e3a8a',
      green: '#166534',
      red: '#b91c1c',
      yellow: '#ca8a04',
      pink: '#db2777',
      beige: '#d6c6a5',
      grey: '#6b7280',
      gray: '#6b7280',
      brown: '#7c2d12',
      orange: '#ea580c',
      purple: '#7e22ce',
    };

    return colorMap[normalized] || '#000000';
  }
}
