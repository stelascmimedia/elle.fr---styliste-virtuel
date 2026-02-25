import { Product, Slot, UserProfile } from '../types';
import { normalizeSimplifiedTdItem } from './normalizers';
import { CATALOG } from './catalog';

export interface CatalogProduct extends Product {
  availability?: string;
  description?: string;
  variantGroupId?: string;
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
const TRADEDOUBLER_API_ROUTE = '/api/catalogue';
const TRADEDOUBLER_QUERY_BUILDER_ROUTE = '/api/td-query-builder';
const DEFAULT_CATALOG_FILE = '/catalogue/catalogue.json';
const ENABLE_SPLIT_FILES = (import.meta as any).env?.VITE_ENABLE_SPLIT_CATALOG === 'true';
const SLOT_TO_Q_TERMS: Record<Slot, string[]> = {
  // Feed-aware vocabulary: keep short terms that actually return hits on TD.
  outerwear: ['jacket', 'coat', 'blazer', 'veste', 'manteau'],
  top: ['top', 't-shirt', 'shirt', 'blouse', 'pull'],
  bottom: ['trousers', 'jean', 'pants', 'skirt', 'pantalon', 'jupe'],
  shoes: ['sandals', 'boots', 'sneakers', 'chaussures', 'baskets', 'shoes'],
  accessory: ['bag', 'belt', 'sac', 'ceinture'],
};

export class CatalogService {
  private static nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  static async fetchProducts(profile?: UserProfile, targetSlots?: Slot[]): Promise<CatalogProduct[]> {
    const tStart = this.nowMs();
    const targetedMode = Boolean(profile && targetSlots && targetSlots.length > 0);
    const tBuildStart = this.nowMs();
    const targetedQueries = targetedMode
      ? await this.buildTargetedQueries(profile, targetSlots)
      : [];
    console.log(`[PERF] catalog.fetch.buildTargetedQueriesMs=${(this.nowMs() - tBuildStart).toFixed(1)} count=${targetedQueries.length}`);
    console.log(
      `[TD] Fetching catalogue from ${TRADEDOUBLER_API_ROUTE} mode=${targetedQueries.length > 0 ? 'targeted' : 'generic'}`,
    );
    let tdApiFailed = false;
    const fromApi = targetedQueries.length > 0
      ? await this.fetchTargetedFromApi(targetedQueries)
      : await this.fetchFromUrl(TRADEDOUBLER_API_ROUTE);
    if (fromApi.length > 0) {
      console.log(`[TD] Loaded ${fromApi.length} products from ${TRADEDOUBLER_API_ROUTE}`);
      const sampleCategories = [...new Set(fromApi.map((item) => item.category))].slice(0, 20);
      const slotDistribution = fromApi.reduce<Record<string, number>>((acc, item) => {
        acc[item.slot] = (acc[item.slot] || 0) + 1;
        return acc;
      }, {});
      console.log(`[TD] slotDistribution=${JSON.stringify(slotDistribution)}`);
      console.log(`[TD] sampleCategories(20)=${sampleCategories.join(' | ')}`);
      console.log(`[PERF] catalog.fetch.totalMs=${(this.nowMs() - tStart).toFixed(1)} source=api`);
      return fromApi;
    }
    tdApiFailed = true;
    if (targetedMode) {
      console.log('[TD] Targeted mode returned 0 products from API; not using API result.');
    }

    if (ENABLE_SPLIT_FILES) {
      const fromDevFiles = await this.fetchFromDevFiles();
      if (fromDevFiles.length > 0) {
        console.log(`[TD] FALLBACK split files used count=${fromDevFiles.length}`);
        console.log(`[PERF] catalog.fetch.totalMs=${(this.nowMs() - tStart).toFixed(1)} source=split_files`);
        return fromDevFiles;
      }
    }

    const fallback = await this.fetchFromUrl(DEFAULT_CATALOG_FILE);
    if (fallback.length > 0) {
      console.log(`[TD] FALLBACK ${DEFAULT_CATALOG_FILE} used count=${fallback.length}`);
      console.log(`[PERF] catalog.fetch.totalMs=${(this.nowMs() - tStart).toFixed(1)} source=local_catalog`);
      return fallback;
    }

    if (tdApiFailed) {
      throw new Error(
        'Catalogue TradeDoubler indisponible: verifiez TD_TOKEN/TD_FID dans .env.local (dev) ou variables d environnement (prod).',
      );
    }

    const emergencyCatalog = this.getEmergencyCatalog();
    if (emergencyCatalog.length > 0) {
      console.log(`[PERF] catalog.fetch.totalMs=${(this.nowMs() - tStart).toFixed(1)} source=emergency`);
      return emergencyCatalog;
    }

    throw new Error('Aucun produit catalogue exploitable');
  }

  private static async fetchTargetedFromApi(queries: URLSearchParams[]): Promise<CatalogProduct[]> {
    const tStart = this.nowMs();
    const allItems: CatalogProduct[] = [];
    for (let i = 0; i < queries.length; i += 1) {
      const query = queries[i];
      const url = `${TRADEDOUBLER_API_ROUTE}?${query.toString()}`;
      const tQueryStart = this.nowMs();
      const products = await this.fetchFromUrl(url);
      console.log(`[TD] targeted query#${i + 1} count=${products.length}`);
      console.log(`[PERF] catalog.targeted.query#${i + 1}.ms=${(this.nowMs() - tQueryStart).toFixed(1)}`);
      if (products.length > 0) {
        allItems.push(...products);
      }
    }
    const deduped = this.dedupeById(allItems);
    console.log(`[PERF] catalog.targeted.totalMs=${(this.nowMs() - tStart).toFixed(1)} before=${allItems.length} after=${deduped.length}`);
    return deduped;
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
    const tStart = this.nowMs();
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
      const normalized = rawItems
        .map((raw) => this.normalizeRawItem(raw))
        .filter((item): item is CatalogProduct => item !== null);
      const isTdEndpoint = url.includes(TRADEDOUBLER_API_ROUTE);
      if (isTdEndpoint) {
        console.log(`[PERF] catalog.fetchFromUrl.ms=${(this.nowMs() - tStart).toFixed(1)} raw=${rawItems.length} normalized=${normalized.length}`);
      }
      return normalized;
    } catch (error) {
      if (url === TRADEDOUBLER_API_ROUTE) {
        console.log(`[TD] Failed to fetch ${TRADEDOUBLER_API_ROUTE}: ${String(error)}`);
      }
      if (url.includes(TRADEDOUBLER_API_ROUTE)) {
        console.log(`[PERF] catalog.fetchFromUrl.ms=${(this.nowMs() - tStart).toFixed(1)} status=error`);
      }
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
    const richCategory =
      raw.category ||
      raw.categories?.[0]?.name ||
      this.getFieldValue(raw.fields, 'g:product_type') ||
      this.getFieldValue(raw.fields, 'product_type') ||
      this.getFieldValue(raw.fields, 'productType') ||
      this.getFieldValue(raw.fields, 'g:google_product_category');
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
      category: richCategory,
    });

    if (normalized.price <= 0) {
      return null;
    }

    return {
      ...normalized,
      availability: raw.availability || raw.offers?.[0]?.availability,
      description: raw.description,
      variantGroupId: this.getVariantGroupId(raw),
    };
  }

  private static getVariantGroupId(raw: LegacyProduct): string | undefined {
    const groupFromFeed =
      this.getFieldValue(raw.fields, 'g:item_group_id') ||
      this.getFieldValue(raw.fields, 'item_group_id') ||
      this.getFieldValue(raw.fields, 'item_groupid');

    const sourceCode =
      groupFromFeed ||
      this.getFieldValue(raw.fields, 'ProductoID') ||
      this.getFieldValue(raw.fields, 'g:mpn') ||
      raw.id;

    if (!sourceCode) return undefined;

    const brand = (raw.brand || 'unknown').toLowerCase().trim();
    const normalizedCode = sourceCode
      .trim()
      .toLowerCase()
      // Remove likely size suffixes (XS/S/M/L/XL/XXL, 37, 38, 3/4, etc.)
      .replace(/([_\- ]?)(xs|s|m|l|xl|xxl|xxxl|\d{2,3}|\d+\/\d+)$/i, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!normalizedCode) return undefined;
    return `${brand}:${normalizedCode}`;
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

  private static async fetchQueryBuilderSuggestions(
    slot: Slot,
    budget: number,
    profile: UserProfile,
  ): Promise<URLSearchParams[]> {
    try {
      const url = new URL(TRADEDOUBLER_QUERY_BUILDER_ROUTE, window.location.origin);
      url.searchParams.set('slot', slot);
      url.searchParams.set('budget', String(budget));
      if (profile.style) url.searchParams.set('style', profile.style);
      if (profile.usage) url.searchParams.set('usage', profile.usage);
      url.searchParams.set('samplePages', '2');
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return [];
      const payload = await response.json();
      const suggestions = Array.isArray(payload?.suggestedQueries)
        ? payload.suggestedQueries
        : [];
      return suggestions
        .map((item: unknown) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .map((item: string) => new URLSearchParams(item));
    } catch (error) {
      console.log(`[TD] Query builder failed for slot=${slot}: ${String(error)}`);
      return [];
    }
  }

  private static async buildTargetedQueries(profile?: UserProfile, targetSlots?: Slot[]): Promise<URLSearchParams[]> {
    if (!profile || !targetSlots || targetSlots.length === 0) return [];

    const slots = [...new Set(targetSlots)];
    const perSlotBudget = Math.max(40, Math.round((profile.budget / Math.max(slots.length, 1)) * 1.8));
    const queries: URLSearchParams[] = [];

    for (const slot of slots) {
      const fromBuilder = await this.fetchQueryBuilderSuggestions(slot, perSlotBudget, profile);
      if (fromBuilder.length > 0) {
        console.log(`[TD] Query builder slot=${slot} suggestions=${fromBuilder.length}`);
        queries.push(...fromBuilder);
        continue;
      }

      const qTerms = SLOT_TO_Q_TERMS[slot] || [];
      // One lexical probe per term; avoid stacking many q/category keys which often yields 0 on this feed.
      for (const term of qTerms) {
        const params = new URLSearchParams();
        params.append('q', term);
        params.set('maxPrice', String(perSlotBudget));
        params.set('pageSize', '100');
        params.set('maxPages', '1');
        queries.push(params);
      }

      // Extra broad probe by style/usage to diversify if lexical terms are sparse.
      const broad = new URLSearchParams();
      broad.append('q', profile.style);
      broad.append('q', profile.usage);
      broad.set('maxPrice', String(perSlotBudget));
      broad.set('pageSize', '100');
      broad.set('maxPages', '1');
      queries.push(broad);
    }

    const deduped = new Map<string, URLSearchParams>();
    for (const query of queries) {
      const key = query.toString();
      if (!deduped.has(key)) deduped.set(key, query);
    }
    return [...deduped.values()];
  }

  private static getEmergencyCatalog(): CatalogProduct[] {
    return CATALOG.map((item) => ({
      ...item,
      availability: 'in stock',
      description: item.title,
      variantGroupId: `${item.brand.toLowerCase()}:${item.id.toLowerCase()}`,
    }));
  }
}
