import { Product } from '../types';
import { normalizeSimplifiedTdItem } from './normalizers';

export interface CatalogProduct extends Product {
  availability?: string;
  description?: string;
}

interface SourceField {
  name?: string;
  value?: string;
}

interface SourceOfferPrice {
  value?: string;
  currency?: string;
}

interface SourceOfferPriceHistory {
  price?: SourceOfferPrice;
}

interface SourceOffer {
  id?: string;
  productUrl?: string;
  availability?: string;
  priceHistory?: SourceOfferPriceHistory[];
}

interface SourceCategory {
  name?: string;
}

interface SourceProductImage {
  url?: string;
}

interface LegacyProduct {
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
  availability?: string;
  fields?: SourceField[];
  offers?: SourceOffer[];
  categories?: SourceCategory[];
  productImage?: SourceProductImage;
}

interface PayloadWithItems {
  items?: LegacyProduct[];
}

interface PayloadWithProducts {
  products?: LegacyProduct[];
}

const DEV_FILES = ['robe.json', 'pull.json', 'pantalon.json', 'manteau.json', 'chaussure.json'];
const DEFAULT_CATALOG_FILE = '/catalogue/catalogue.json';
const ENABLE_SPLIT_FILES = (import.meta as any).env?.VITE_ENABLE_SPLIT_CATALOG === 'true';

export class CatalogService {
  static async fetchProducts(): Promise<CatalogProduct[]> {
    if (ENABLE_SPLIT_FILES) {
      const fromDevFiles = await this.fetchFromDevFiles();
      if (fromDevFiles.length > 0) {
        console.log(`[CATALOG] Loaded ${fromDevFiles.length} products from simplified dev files`);
        return fromDevFiles;
      }
      console.warn('[CATALOG] Split catalog mode enabled but no split file was usable, fallback to catalogue.json');
    }

    const fallback = await this.fetchFromUrl(DEFAULT_CATALOG_FILE);
    if (fallback.length > 0) {
      console.log(`[CATALOG] Loaded ${fallback.length} products from ${DEFAULT_CATALOG_FILE}`);
      return fallback;
    }

    throw new Error('Aucun produit catalogue exploitable');
  }

  private static async fetchFromDevFiles(): Promise<CatalogProduct[]> {
    const allItems: CatalogProduct[] = [];
    await Promise.all(
      DEV_FILES.map(async (filename) => {
        const url = `/catalogue/${filename}`;
        const products = await this.fetchFromUrl(url);
        if (products.length > 0) {
          allItems.push(...products);
        }
      }),
    );

    return this.dedupeById(allItems);
  }

  private static async fetchFromUrl(url: string): Promise<CatalogProduct[]> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        return [];
      }

      const payload = (await response.json()) as PayloadWithItems | PayloadWithProducts | LegacyProduct[];
      const rawItems = this.extractRawItems(payload);
      return rawItems
        .map((raw) => this.normalizeRawItem(raw))
        .filter((item): item is CatalogProduct => item !== null);
    } catch (error) {
      console.warn(`[CATALOG] Failed to load ${url}`, error);
      return [];
    }
  }

  private static extractRawItems(payload: PayloadWithItems | PayloadWithProducts | LegacyProduct[]): LegacyProduct[] {
    if (Array.isArray(payload)) return payload;
    if ('items' in payload && Array.isArray(payload.items)) return payload.items;
    if ('products' in payload && Array.isArray(payload.products)) return payload.products;
    return [];
  }

  private static normalizeRawItem(raw: LegacyProduct): CatalogProduct | null {
    const salePrice = this.getFieldValue(raw.fields, 'Sale price')?.trim();
    const normalized = normalizeSimplifiedTdItem({
      id: raw.id || this.getFieldValue(raw.fields, 'ProductoID') || this.getFieldValue(raw.fields, 'g:mpn'),
      title: raw.title || raw.name,
      description: raw.description,
      brand: raw.brand,
      image:
        raw.image ||
        raw.productImage?.url ||
        this.getFieldValue(raw.fields, 'g:additional_image_link'),
      affiliateUrl: raw.affiliateUrl || raw.offers?.[0]?.productUrl,
      // Some feeds provide an empty string for "Sale price"; treat it as missing
      // so we can correctly fallback to offer.priceHistory.
      price: raw.price ?? (salePrice || undefined) ?? this.getOfferPrice(raw.offers?.[0]),
      currency: raw.currency || this.getOfferCurrency(raw.offers?.[0]) || 'EUR',
      category: raw.category || raw.categories?.[0]?.name,
    });

    if (normalized.price <= 0) {
      return null;
    }

    return {
      ...normalized,
      availability: raw.availability || raw.offers?.[0]?.availability,
      description: raw.description,
    };
  }

  private static getOfferPrice(offer?: SourceOffer): string | undefined {
    const history = offer?.priceHistory || [];
    return history[history.length - 1]?.price?.value;
  }

  private static getOfferCurrency(offer?: SourceOffer): string | undefined {
    const history = offer?.priceHistory || [];
    return history[history.length - 1]?.price?.currency;
  }

  private static getFieldValue(fields: SourceField[] | undefined, key: string): string | undefined {
    return fields?.find((field) => field.name === key)?.value;
  }

  private static dedupeById(items: CatalogProduct[]): CatalogProduct[] {
    const map = new Map<string, CatalogProduct>();
    for (const item of items) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return [...map.values()];
  }
}
