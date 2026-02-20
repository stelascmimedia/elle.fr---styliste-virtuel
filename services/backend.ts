import { GoogleGenAI } from '@google/genai';
import { UserProfile, GeneratedLook, LookVariant, Product, Slot } from '../types';
import { LOOK_VARIATION_INSTRUCTIONS, MATCHING_CONFIG, PROMPT_TEMPLATE } from '../constants';
import { CatalogProduct, CatalogService } from './catalogService';
import { rankOutfitWithLLM, RankedOutfit } from './llmRankerService';

interface InlineImage {
  mimeType: string;
  data: string;
}

interface MatchOptions {
  excludedProductIds?: Set<string>;
  randomness?: number;
  lookIndex?: number;
}

interface RankedCandidate {
  id: string;
  title: string;
  description?: string;
  brand: string;
  price: number;
  currency: string;
  category: string;
  affiliateUrl: string;
  image: string;
  availability?: string;
}

/**
 * Service simulant l'appel backend securise.
 */
export class BackendService {
  private static readonly TOTAL_LOOKS_TO_GENERATE = 5;

  static async generateLook(profile: UserProfile): Promise<GeneratedLook> {
    console.log('[MATCH] Starting generation with profile:', profile);

    const catalog = await CatalogService.fetchProducts();
    console.log(`[MATCH] Catalog loaded: ${catalog.length} products`);

    let outfits = await this.generateDiverseOutfits(profile, catalog, this.TOTAL_LOOKS_TO_GENERATE);
    if (outfits.length === 0) {
      const emergencyOutfit = this.buildEmergencyOutfit(profile, catalog);
      if (emergencyOutfit.length > 0) {
        console.warn('[MATCH] Using emergency outfit because no outfit was produced');
        outfits = [emergencyOutfit];
      }
    }
    console.log(`[MATCH] Outfits built: ${outfits.length}/${this.TOTAL_LOOKS_TO_GENERATE}`);

    const renderedLooks = await this.generateRenderedLooks(profile, outfits);
    if (renderedLooks.length === 0) {
      throw new Error('Impossible de generer les silhouettes. Verifiez vos permissions ou reessayez.');
    }

    const [primaryLook, ...alternatives] = renderedLooks;
    return {
      ...primaryLook,
      alternatives,
      debug: {
        rulesVersion: '2.0',
        model: 'gemini-3-pro-image-preview',
        rankerModel: 'gemini-2.0-flash',
        requestedLooks: this.TOTAL_LOOKS_TO_GENERATE,
        generatedLooks: renderedLooks.length,
      },
    };
  }

  private static async generateRenderedLooks(profile: UserProfile, outfits: Product[][]): Promise<LookVariant[]> {
    const renderedLooks: LookVariant[] = [];

    for (const outfit of outfits) {
      const totalPrice = outfit.reduce((sum, item) => sum + item.price, 0);
      try {
        const imageUrl = await this.generateLookImage(profile, outfit);
        renderedLooks.push({ imageUrl, outfit, totalPrice });
      } catch (error) {
        console.warn('[MATCH] One rendered look failed, using fallback image:', error);
        const fallbackImage = outfit[0]?.image || 'https://picsum.photos/seed/fallback-look/720/1280';
        renderedLooks.push({ imageUrl: fallbackImage, outfit, totalPrice });
      }
    }

    return renderedLooks;
  }

  private static async generateDiverseOutfits(profile: UserProfile, catalog: CatalogProduct[], count: number): Promise<Product[][]> {
    const outfits: Product[][] = [];
    const usedProductIds = new Set<string>();
    const seenSignatures = new Set<string>();

    for (let index = 0; index < count; index += 1) {
      const strictOutfit = await this.matchOutfit(profile, catalog, {
        excludedProductIds: usedProductIds,
        lookIndex: index,
        randomness: 0.2,
      });

      let selectedOutfit = strictOutfit;
      let signature = this.getOutfitSignature(selectedOutfit);

      if (!selectedOutfit.length || seenSignatures.has(signature)) {
        const relaxedOutfit = await this.matchOutfit(profile, catalog, {
          lookIndex: index,
          randomness: 0.35,
        });
        const relaxedSignature = this.getOutfitSignature(relaxedOutfit);
        if (relaxedOutfit.length && !seenSignatures.has(relaxedSignature)) {
          selectedOutfit = relaxedOutfit;
          signature = relaxedSignature;
        }
      }

      if (!selectedOutfit.length || seenSignatures.has(signature)) {
        continue;
      }

      outfits.push(selectedOutfit);
      seenSignatures.add(signature);
      selectedOutfit.forEach((product) => usedProductIds.add(product.id));
    }

    if (outfits.length === 0) {
      const fallback = await this.matchOutfit(profile, catalog, { lookIndex: 0, randomness: 0.1 });
      if (fallback.length > 0) outfits.push(fallback);
    }

    return outfits;
  }

  private static getOutfitSignature(outfit: Product[]): string {
    return outfit.map((item) => item.id).sort().join('|');
  }

  private static buildEmergencyOutfit(profile: UserProfile, catalog: CatalogProduct[]): Product[] {
    const requiredSlots =
      MATCHING_CONFIG.meteoToSlots[profile.season_meteo as keyof typeof MATCHING_CONFIG.meteoToSlots] || ['top', 'bottom', 'shoes'];
    const selected: Product[] = [];
    let remainingBudget = profile.budget * 1.05;

    for (let index = 0; index < requiredSlots.length; index += 1) {
      const slot = requiredSlots[index];
      const remainingSlots = requiredSlots.length - index;
      const maxPrice = remainingBudget / Math.max(remainingSlots, 1);

      const candidate = catalog
        .filter((product) => product.slot === slot && product.price > 0 && product.currency === 'EUR')
        .sort((a, b) => a.price - b.price)
        .find((product) => product.price <= maxPrice)
        || catalog
          .filter((product) => product.slot === slot && product.price > 0 && product.currency === 'EUR')
          .sort((a, b) => a.price - b.price)[0];

      if (!candidate) {
        return [];
      }

      selected.push(candidate);
      remainingBudget -= candidate.price;
    }

    return selected;
  }

  private static async matchOutfit(profile: UserProfile, catalog: CatalogProduct[], options: MatchOptions = {}): Promise<Product[]> {
    const requiredSlots =
      MATCHING_CONFIG.meteoToSlots[profile.season_meteo as keyof typeof MATCHING_CONFIG.meteoToSlots] || ['top', 'bottom', 'shoes'];
    const productMap = new Map<string, CatalogProduct>(catalog.map((item) => [item.id, item]));
    const candidatesBySlot = this.buildCandidatesBySlot(profile, requiredSlots, catalog, options);

    for (const slot of requiredSlots) {
      const brands = candidatesBySlot[slot].slice(0, 5).map((item) => item.brand);
      console.log(`[MATCH] Slot=${slot} candidates=${candidatesBySlot[slot].length}, top brands=${brands.join(', ')}`);
      if (candidatesBySlot[slot].length === 0) {
        console.warn(`[MATCH] Slot=${slot} has no candidates, fallback deterministic`);
        return this.matchOutfitDeterministic(profile, requiredSlots, candidatesBySlot, productMap, options);
      }
    }

    try {
      const ranked = await rankOutfitWithLLM({
        profile,
        requiredSlots,
        candidatesBySlot,
        lookIndex: options.lookIndex,
        variationInstruction: LOOK_VARIATION_INSTRUCTIONS[options.lookIndex ?? 0],
      });

      const validated = this.validateRankedOutfit(profile, requiredSlots, ranked, candidatesBySlot, productMap);
      if (!validated) {
        console.warn('[MATCH] LLM ranker produced invalid outfit, fallback deterministic');
        return this.matchOutfitDeterministic(profile, requiredSlots, candidatesBySlot, productMap, options);
      }

      const totalPrice = validated.reduce((sum, item) => sum + item.price, 0);
      console.log('[MATCH] LLM outfit selected:', validated.map((item) => `${item.slot}:${item.id}`));
      console.log(`[MATCH] LLM outfit totalPrice=${totalPrice}`);
      return validated;
    } catch (error) {
      console.warn('[MATCH] LLM ranker failed, fallback deterministic:', error);
      return this.matchOutfitDeterministic(profile, requiredSlots, candidatesBySlot, productMap, options);
    }
  }

  private static buildCandidatesBySlot(
    profile: UserProfile,
    requiredSlots: Slot[],
    catalog: CatalogProduct[],
    options: MatchOptions,
  ): Record<Slot, RankedCandidate[]> {
    const candidatesBySlot: Record<Slot, RankedCandidate[]> = {
      outerwear: [],
      top: [],
      bottom: [],
      shoes: [],
      accessory: [],
    };

    let simulatedRemainingBudget = profile.budget;
    requiredSlots.forEach((slot, index) => {
      const remainingSlots = requiredSlots.length - index;
      const maxPriceForSlot = (simulatedRemainingBudget / Math.max(remainingSlots, 1)) * 1.5;
      const filtered = catalog.filter((product) =>
        this.passesHardFilters(product, profile, slot, maxPriceForSlot, options.excludedProductIds),
      );

      const shortlisted = this.shortlistByPriceAndBrand(filtered, 40);
      const slotCandidates = shortlisted.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        brand: item.brand,
        price: item.price,
        currency: item.currency,
        category: item.category,
        affiliateUrl: item.affiliateUrl,
        image: item.image,
        availability: item.availability,
      }));

      candidatesBySlot[slot] = slotCandidates;
      const cheapest = slotCandidates[0]?.price ?? 0;
      if (cheapest > 0) simulatedRemainingBudget -= cheapest;
    });

    return candidatesBySlot;
  }

  private static passesHardFilters(
    product: CatalogProduct,
    profile: UserProfile,
    slot: Slot,
    maxPriceForSlot: number,
    excludedProductIds?: Set<string>,
  ): boolean {
    if (product.slot !== slot) return false;
    if (excludedProductIds?.has(product.id)) return false;
    if (product.currency !== 'EUR') return false;
    if (product.price <= 0 || product.price > maxPriceForSlot) return false;
    if (product.availability && !/in stock/i.test(product.availability)) return false;

    const text = `${product.category} ${product.title} ${product.description || ''}`.toLowerCase();
    if (profile.age >= 16 && /\b(girl|boy|enfant)\b/i.test(text)) return false;

    const category = product.category.toLowerCase();
    if (profile.sex === 'femme' && /\bman\b/i.test(category) && !/\bwoman\b/i.test(category)) return false;
    if (profile.sex === 'homme' && /\bwoman\b/i.test(category)) return false;

    return true;
  }

  private static shortlistByPriceAndBrand(products: CatalogProduct[], limit: number): CatalogProduct[] {
    const sorted = [...products].sort((a, b) => a.price - b.price);
    const byBrand = new Map<string, CatalogProduct[]>();
    for (const product of sorted) {
      const key = product.brand || 'unknown';
      const list = byBrand.get(key) || [];
      list.push(product);
      byBrand.set(key, list);
    }

    const brandKeys = [...byBrand.keys()];
    const shortlisted: CatalogProduct[] = [];
    let cursor = 0;
    while (shortlisted.length < limit && brandKeys.length > 0) {
      const brand = brandKeys[cursor % brandKeys.length];
      const pool = byBrand.get(brand);
      if (pool && pool.length > 0) {
        shortlisted.push(pool.shift() as CatalogProduct);
      }

      if (!pool || pool.length === 0) {
        byBrand.delete(brand);
        brandKeys.splice(cursor % brandKeys.length, 1);
        if (brandKeys.length === 0) break;
        continue;
      }

      cursor += 1;
    }

    return shortlisted.slice(0, limit);
  }

  private static validateRankedOutfit(
    profile: UserProfile,
    requiredSlots: Slot[],
    ranked: RankedOutfit,
    candidatesBySlot: Record<Slot, RankedCandidate[]>,
    productMap: Map<string, CatalogProduct>,
  ): Product[] | null {
    if (!Array.isArray(ranked.outfit) || ranked.outfit.length !== requiredSlots.length) return null;

    const usedSlots = new Set<Slot>();
    const selectedProducts: Product[] = [];

    for (const slot of requiredSlots) {
      const pick = ranked.outfit.find((item) => item.slot === slot);
      if (!pick) return null;
      if (usedSlots.has(slot)) return null;
      usedSlots.add(slot);

      const candidateInSlot = candidatesBySlot[slot].find((candidate) => candidate.id === pick.id);
      if (!candidateInSlot) return null;

      const product = productMap.get(pick.id);
      if (!product) return null;
      selectedProducts.push(product);
    }

    const totalPrice = selectedProducts.reduce((sum, item) => sum + item.price, 0);
    if (totalPrice > profile.budget * 1.05) return null;

    return selectedProducts;
  }

  private static matchOutfitDeterministic(
    profile: UserProfile,
    requiredSlots: Slot[],
    candidatesBySlot: Record<Slot, RankedCandidate[]>,
    productMap: Map<string, CatalogProduct>,
    options: MatchOptions,
  ): Product[] {
    const selected: Product[] = [];
    const localUsed = new Set<string>(options.excludedProductIds ? [...options.excludedProductIds] : []);
    let remainingBudget = profile.budget * 1.05;
    const randomness = options.randomness ?? 0.2;

    for (let index = 0; index < requiredSlots.length; index += 1) {
      const slot = requiredSlots[index];
      const remainingSlots = requiredSlots.length - index;
      const maxPriceForSlot = remainingBudget / Math.max(remainingSlots, 1);
      const slotCandidates = candidatesBySlot[slot].filter((candidate) => !localUsed.has(candidate.id));
      if (slotCandidates.length === 0) return [];

      const affordable = slotCandidates.filter((candidate) => candidate.price <= maxPriceForSlot);
      const sorted = (affordable.length > 0 ? affordable : slotCandidates).sort((a, b) => a.price - b.price);
      const topN = Math.max(1, Math.min(sorted.length, 1 + Math.floor(randomness * 4)));
      const chosen = sorted[Math.floor(Math.random() * topN)];
      const product = productMap.get(chosen.id);
      if (!product) return [];

      selected.push(product);
      localUsed.add(chosen.id);
      remainingBudget -= chosen.price;
    }

    const totalPrice = selected.reduce((sum, item) => sum + item.price, 0);
    console.log(`[MATCH] Deterministic fallback selected totalPrice=${totalPrice}`);
    return totalPrice <= profile.budget * 1.05 ? selected : [];
  }

  private static async generateLookImage(profile: UserProfile, outfit: Product[]): Promise<string> {
    const clothingDesc = outfit.map((p) => `- ${p.title} (${p.brand}) en couleur ${p.colorHex}, style ${p.category}`).join('\n');
    const prompt = PROMPT_TEMPLATE
      .replace('{CLOTHING_DESCRIPTION}', clothingDesc)
      .replace('{AGE}', profile.age.toString())
      .replace('{STYLE}', profile.style)
      .replace('{WEATHER}', profile.season_meteo)
      .replace('{AUDACITY}', profile.audace)
      .split('{SEXE}')
      .join(profile.sex);

    const referenceImages = await this.loadReferenceImages(outfit);
    console.log(`[MATCH] Reference images available for Gemini: ${referenceImages.length}/${outfit.length}`);

    const parts: Array<{ text: string } | { inlineData: InlineImage }> = [
      {
        text: `${prompt}\n\nUtilise imperativement aussi les images de reference produits jointes pour reproduire fidelement les vetements (coupe, matieres, motifs, details, couleurs).`,
      },
      ...referenceImages.map((image) => ({ inlineData: image })),
    ];

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: '9:16',
          imageSize: '1K',
        },
      },
    });

    let imageUrl = '';
    const responseCandidates = response.candidates;
    if (responseCandidates && responseCandidates.length > 0) {
      for (const part of responseCandidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      throw new Error("Impossible de générer l'image. Vérifiez vos permissions ou réessayez.");
    }

    return imageUrl;
  }

  private static async loadReferenceImages(outfit: Product[]): Promise<InlineImage[]> {
    const loadedImages = await Promise.all(
      outfit.map(async (product) => {
        const inlineData = await this.fetchImageAsInlineData(product.image);
        if (!inlineData) {
          console.warn(`[MATCH] Image fetch failed for product ${product.id}: ${product.image}`);
          return null;
        }
        return inlineData;
      }),
    );

    return loadedImages.filter((image): image is InlineImage => image !== null);
  }

  private static getProxyImageUrl(imageUrl: string): string {
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }

    return `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
  }

  private static async fetchImageAsInlineData(imageUrl: string): Promise<InlineImage | null> {
    try {
      const targetUrl = this.getProxyImageUrl(imageUrl);
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const mimeTypeHeader = response.headers.get('content-type') || 'image/jpeg';
      const mimeType = mimeTypeHeader.split(';')[0].trim();
      if (!mimeType.startsWith('image/')) {
        throw new Error(`Unsupported content-type: ${mimeType}`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      const chunkSize = 0x8000;
      let binary = '';

      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }

      return {
        mimeType,
        data: btoa(binary),
      };
    } catch (error) {
      console.warn(`[MATCH] Could not convert image to inlineData: ${imageUrl}`, error);
      return null;
    }
  }
}
