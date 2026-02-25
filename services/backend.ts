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
  excludedProductKeys?: Set<string>;
  randomness?: number;
  lookIndex?: number;
}

interface RankedCandidate {
  id: string;
  exclusionKey: string;
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

type FilterRejectionReason =
  | 'slot_mismatch'
  | 'excluded_id'
  | 'currency'
  | 'price'
  | 'availability'
  | 'age'
  | 'gender'
  | 'fit';

/**
 * Service simulant l'appel backend securise.
 */
export class BackendService {
  private static readonly TOTAL_LOOKS_TO_GENERATE = 5;
  private static nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
  private static formatError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  private static buildRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  static async generateLook(profile: UserProfile): Promise<GeneratedLook> {
    const tStart = this.nowMs();
    const runId = this.buildRunId();
    const keyAlias = process.env.GEMINI_KEY_ALIAS || 'unknown';
    console.log(`[COST] run.start runId=${runId} keyAlias=${keyAlias} requestedLooks=${this.TOTAL_LOOKS_TO_GENERATE}`);
    const requiredSlots = this.getRequiredSlots(profile);
    const tCatalogStart = this.nowMs();
    const catalog = await CatalogService.fetchProducts(profile, requiredSlots);
    console.log(`[PERF] generateLook.catalogFetchMs=${(this.nowMs() - tCatalogStart).toFixed(1)}`);
    const slotDistribution = catalog.reduce<Record<string, number>>((acc, product) => {
      acc[product.slot] = (acc[product.slot] || 0) + 1;
      return acc;
    }, {});
    console.log(`[DBG_MATCH] catalog size=${catalog.length} slotDistribution=${JSON.stringify(slotDistribution)}`);

    const tOutfitsStart = this.nowMs();
    let outfits = await this.generateDiverseOutfits(profile, catalog, this.TOTAL_LOOKS_TO_GENERATE);
    console.log(`[PERF] generateLook.outfitMatchingMs=${(this.nowMs() - tOutfitsStart).toFixed(1)}`);
    if (outfits.length === 0) {
      const emergencyOutfit = this.buildEmergencyOutfit(profile, catalog);
      if (emergencyOutfit.length > 0) {
        outfits = [emergencyOutfit];
      }
    }

    const tRenderStart = this.nowMs();
    const renderedLooks = await this.generateRenderedLooks(profile, outfits);
    console.log(`[PERF] generateLook.renderLooksMs=${(this.nowMs() - tRenderStart).toFixed(1)}`);
    if (renderedLooks.length === 0) {
      throw new Error('Impossible de generer les silhouettes. Verifiez vos permissions ou reessayez.');
    }

    const [primaryLook, ...alternatives] = renderedLooks;
    const result = {
      ...primaryLook,
      alternatives,
      debug: {
        rulesVersion: '2.0',
        model: 'gemini-3-pro-image-preview',
        rankerModel: 'gemini-2.0-flash',
        runId,
        keyAlias,
        requestedLooks: this.TOTAL_LOOKS_TO_GENERATE,
        generatedLooks: renderedLooks.length,
      },
    };
    console.log(`[COST] run.end runId=${runId} keyAlias=${keyAlias} generatedLooks=${renderedLooks.length} totalMs=${(this.nowMs() - tStart).toFixed(1)}`);
    console.log(`[PERF] generateLook.totalMs=${(this.nowMs() - tStart).toFixed(1)}`);
    return result;
  }

  private static async generateRenderedLooks(profile: UserProfile, outfits: Product[][]): Promise<LookVariant[]> {
    const tStart = this.nowMs();
    const renderedLooks: LookVariant[] = [];

    for (let i = 0; i < outfits.length; i += 1) {
      const outfit = outfits[i];
      const tLookStart = this.nowMs();
      const totalPrice = outfit.reduce((sum, item) => sum + item.price, 0);
      try {
        const imageUrl = await this.generateLookImage(profile, outfit);
        renderedLooks.push({ imageUrl, outfit, totalPrice });
        console.log(`[PERF] generateRenderedLooks.lookIndex=${i} status=ok ms=${(this.nowMs() - tLookStart).toFixed(1)}`);
      } catch (error) {
        console.error(`[ERR_IMAGE] lookIndex=${i} ${this.formatError(error)}`);
        const fallbackImage = outfit[0]?.image || 'https://picsum.photos/seed/fallback-look/720/1280';
        renderedLooks.push({ imageUrl: fallbackImage, outfit, totalPrice });
        console.log(`[PERF] generateRenderedLooks.lookIndex=${i} status=fallback ms=${(this.nowMs() - tLookStart).toFixed(1)}`);
      }
    }

    console.log(`[PERF] generateRenderedLooks.totalMs=${(this.nowMs() - tStart).toFixed(1)}`);
    return renderedLooks;
  }

  private static async generateDiverseOutfits(profile: UserProfile, catalog: CatalogProduct[], count: number): Promise<Product[][]> {
    const tStart = this.nowMs();
    const outfits: Product[][] = [];
    const usedProductKeys = new Set<string>();
    const seenSignatures = new Set<string>();

    for (let index = 0; index < count; index += 1) {
      const tLookStart = this.nowMs();
      const strictOutfit = await this.matchOutfit(profile, catalog, {
        excludedProductKeys: usedProductKeys,
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
        console.log(`[PERF] generateDiverseOutfits.lookIndex=${index} status=skipped ms=${(this.nowMs() - tLookStart).toFixed(1)}`);
        continue;
      }

      outfits.push(selectedOutfit);
      seenSignatures.add(signature);
      selectedOutfit.forEach((product) => usedProductKeys.add(this.getProductExclusionKey(product)));
      console.log(`[PERF] generateDiverseOutfits.lookIndex=${index} status=accepted ms=${(this.nowMs() - tLookStart).toFixed(1)}`);
    }

    if (outfits.length === 0) {
      const tFallback = this.nowMs();
      const fallback = await this.matchOutfit(profile, catalog, { lookIndex: 0, randomness: 0.1 });
      if (fallback.length > 0) outfits.push(fallback);
      console.log(`[PERF] generateDiverseOutfits.emergencyMatchMs=${(this.nowMs() - tFallback).toFixed(1)}`);
    }

    console.log(`[PERF] generateDiverseOutfits.totalMs=${(this.nowMs() - tStart).toFixed(1)} generated=${outfits.length}/${count}`);
    return outfits;
  }

  private static getOutfitSignature(outfit: Product[]): string {
    return outfit.map((item) => this.getProductExclusionKey(item)).sort().join('|');
  }

  private static buildEmergencyOutfit(profile: UserProfile, catalog: CatalogProduct[]): Product[] {
    const requiredSlots = this.getRequiredSlots(profile);
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
    const tStart = this.nowMs();
    const requiredSlots = this.getRequiredSlots(profile);
    console.log(
      `[DBG_SHOES] matchOutfit start lookIndex=${options.lookIndex ?? 'na'} randomness=${options.randomness ?? 'na'} budget=${profile.budget} requiredSlots=${requiredSlots.join(
        ',',
      )} excludedCount=${options.excludedProductKeys?.size ?? 0}`,
    );
    const productMap = new Map<string, CatalogProduct>(catalog.map((item) => [item.id, item]));
    const tCandidatesStart = this.nowMs();
    const candidatesBySlot = this.buildCandidatesBySlot(profile, requiredSlots, catalog, options);
    console.log(`[PERF] matchOutfit.lookIndex=${options.lookIndex ?? 'na'} candidatesMs=${(this.nowMs() - tCandidatesStart).toFixed(1)}`);

    for (const slot of requiredSlots) {
      if (candidatesBySlot[slot].length === 0) {
        console.log(`[PERF] matchOutfit.lookIndex=${options.lookIndex ?? 'na'} mode=deterministic reason=empty_slot totalMs=${(this.nowMs() - tStart).toFixed(1)}`);
        return this.matchOutfitDeterministic(profile, requiredSlots, candidatesBySlot, productMap, options);
      }
    }

    try {
      const tRankStart = this.nowMs();
      const ranked = await rankOutfitWithLLM({
        profile,
        requiredSlots,
        candidatesBySlot,
        lookIndex: options.lookIndex,
        variationInstruction: LOOK_VARIATION_INSTRUCTIONS[options.lookIndex ?? 0],
      });
      console.log(`[PERF] matchOutfit.lookIndex=${options.lookIndex ?? 'na'} rankerMs=${(this.nowMs() - tRankStart).toFixed(1)}`);

      const validated = this.validateRankedOutfit(profile, requiredSlots, ranked, candidatesBySlot, productMap);
      if (!validated) {
        console.log('[DBG_SHOES] LLM outfit rejected by backend validation, fallback deterministic');
        console.log(`[PERF] matchOutfit.lookIndex=${options.lookIndex ?? 'na'} mode=deterministic reason=llm_validation totalMs=${(this.nowMs() - tStart).toFixed(1)}`);
        return this.matchOutfitDeterministic(profile, requiredSlots, candidatesBySlot, productMap, options);
      }

      const selectedShoes = validated.find((item) => item.slot === 'shoes');
      console.log(
        `[DBG_SHOES] LLM outfit accepted shoes=${selectedShoes?.id ?? 'none'} title="${selectedShoes?.title ?? ''}" price=${selectedShoes?.price ?? 'na'}`,
      );
      console.log(`[PERF] matchOutfit.lookIndex=${options.lookIndex ?? 'na'} mode=llm totalMs=${(this.nowMs() - tStart).toFixed(1)}`);
      return validated;
    } catch (error) {
      console.error(`[ERR_RANKER] lookIndex=${options.lookIndex ?? 'na'} ${this.formatError(error)}`);
      console.log(`[DBG_SHOES] LLM ranking failed -> fallback deterministic reason=${String(error)}`);
      console.log(`[PERF] matchOutfit.lookIndex=${options.lookIndex ?? 'na'} mode=deterministic reason=llm_error totalMs=${(this.nowMs() - tStart).toFixed(1)}`);
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
      const rejectedByReason: Record<FilterRejectionReason, number> = {
        slot_mismatch: 0,
        excluded_id: 0,
        currency: 0,
        price: 0,
        availability: 0,
        age: 0,
        gender: 0,
        fit: 0,
      };
      const filtered: CatalogProduct[] = [];
      for (const product of catalog) {
        const result = this.evaluateHardFilter(product, profile, slot, maxPriceForSlot, options.excludedProductKeys);
        if (result.ok) {
          filtered.push(product);
        } else {
          rejectedByReason[result.reason] += 1;
        }
      }

      const shortlisted = this.shortlistByPriceAndBrand(filtered, 40);
      const slotCandidates = shortlisted.map((item) => ({
        id: item.id,
        exclusionKey: this.getProductExclusionKey(item),
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

      const filteredIds = filtered.slice(0, 10).map((item) => item.id);
      const filteredCats = filtered.slice(0, 10).map((item) => item.category);
      const shortlistPreview = slotCandidates.slice(0, 10).map((item) => `${item.id}:${item.price}`);
      console.log(
        `[DBG_MATCH] candidates slot=${slot} maxPriceForSlot=${maxPriceForSlot.toFixed(2)} filtered=${filtered.length} shortlisted=${slotCandidates.length} rejected=${JSON.stringify(
          rejectedByReason,
        )}`,
      );
      console.log(`[DBG_MATCH] slot=${slot} filtered ids(10)=${filteredIds.join(',')}`);
      console.log(`[DBG_MATCH] slot=${slot} filtered categories(10)=${filteredCats.join(' | ')}`);
      console.log(`[DBG_MATCH] slot=${slot} shortlist id:price(10)=${shortlistPreview.join(',')}`);
    });

    return candidatesBySlot;
  }

  private static passesHardFilters(
    product: CatalogProduct,
    profile: UserProfile,
    slot: Slot,
    maxPriceForSlot: number,
    excludedProductKeys?: Set<string>,
  ): boolean {
    return this.evaluateHardFilter(product, profile, slot, maxPriceForSlot, excludedProductKeys).ok;
  }

  private static evaluateHardFilter(
    product: CatalogProduct,
    profile: UserProfile,
    slot: Slot,
    maxPriceForSlot: number,
    excludedProductKeys?: Set<string>,
  ): { ok: true } | { ok: false; reason: FilterRejectionReason } {
    if (product.slot !== slot) return { ok: false, reason: 'slot_mismatch' };
    if (excludedProductKeys?.has(this.getProductExclusionKey(product))) return { ok: false, reason: 'excluded_id' };
    if (product.currency !== 'EUR') return { ok: false, reason: 'currency' };
    if (product.price <= 0 || product.price > maxPriceForSlot) return { ok: false, reason: 'price' };
    if (product.availability && !/\b(in\s*stock|instock|available|en\s*stock)\b/i.test(product.availability)) {
      return { ok: false, reason: 'availability' };
    }

    const text = `${product.category} ${product.title} ${product.description || ''}`.toLowerCase();
    if (/\b(girl|boy|enfant)\b/i.test(text)) return { ok: false, reason: 'age' };

    const category = product.category.toLowerCase();
    if (/\bman\b/i.test(category) && !/\bwoman\b/i.test(category)) return { ok: false, reason: 'gender' };

    if (profile.fitPreference === 'ajuste' && /\b(oversize|loose|baggy|wide)\b/i.test(text)) {
      return { ok: false, reason: 'fit' };
    }
    if (profile.fitPreference === 'oversize' && /\b(slim|skinny|fitted|ajuste)\b/i.test(text)) {
      return { ok: false, reason: 'fit' };
    }

    return { ok: true };
  }

  private static getRequiredSlots(profile: UserProfile): Slot[] {
    const baseSlots = MATCHING_CONFIG.temperatureToSlots[profile.temperature] || ['top', 'bottom', 'shoes'];
    if (profile.rain === 'oui' && !baseSlots.includes('outerwear')) {
      return ['outerwear', ...baseSlots];
    }
    return baseSlots;
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
    const localUsed = new Set<string>(options.excludedProductKeys ? [...options.excludedProductKeys] : []);
    let remainingBudget = profile.budget * 1.05;
    const randomness = options.randomness ?? 0.2;

    for (let index = 0; index < requiredSlots.length; index += 1) {
      const slot = requiredSlots[index];
      const remainingSlots = requiredSlots.length - index;
      const maxPriceForSlot = remainingBudget / Math.max(remainingSlots, 1);
      const slotCandidates = candidatesBySlot[slot].filter((candidate) => !localUsed.has(candidate.exclusionKey));
      if (slotCandidates.length === 0) return [];

      const affordable = slotCandidates.filter((candidate) => candidate.price <= maxPriceForSlot);
      const sorted = (affordable.length > 0 ? affordable : slotCandidates).sort((a, b) => a.price - b.price);
      const topN = Math.max(1, Math.min(sorted.length, 1 + Math.floor(randomness * 4)));
      const chosen = sorted[Math.floor(Math.random() * topN)];

      if (slot === 'shoes') {
        const sortedPreview = sorted.slice(0, 10).map((item) => `${item.id}:${item.price}`);
        console.log(
          `[DBG_SHOES] deterministic slot=shoes remainingBudget=${remainingBudget.toFixed(2)} maxPriceForSlot=${maxPriceForSlot.toFixed(
            2,
          )} candidates=${slotCandidates.length} affordable=${affordable.length} topN=${topN}`,
        );
        console.log(`[DBG_SHOES] deterministic sorted id:price(10)=${sortedPreview.join(',')}`);
        console.log(`[DBG_SHOES] deterministic chosen shoes=${chosen.id}:${chosen.price}`);
      }

      const product = productMap.get(chosen.id);
      if (!product) return [];

      selected.push(product);
      localUsed.add(chosen.exclusionKey);
      remainingBudget -= chosen.price;
    }

    const totalPrice = selected.reduce((sum, item) => sum + item.price, 0);
    return totalPrice <= profile.budget * 1.05 ? selected : [];
  }

  private static async generateLookImage(profile: UserProfile, outfit: Product[]): Promise<string> {
    const tStart = this.nowMs();
    const clothingDesc = outfit.map((p) => `- ${p.title} (${p.brand}) en couleur ${p.colorHex}, style ${p.category}`).join('\n');
    const prompt = PROMPT_TEMPLATE
      .replace('{CLOTHING_DESCRIPTION}', clothingDesc)
      .replace('{AGE}', profile.age.toString())
      .replace('{USAGE}', profile.usage)
      .replace('{STYLE}', profile.style)
      .replace('{TEMPERATURE}', profile.temperature)
      .replace('{RAIN}', profile.rain)
      .replace('{FIT}', profile.fitPreference);

    const tRefsStart = this.nowMs();
    const referenceImages = await this.loadReferenceImages(outfit);
    console.log(`[PERF] generateLookImage.referenceImagesMs=${(this.nowMs() - tRefsStart).toFixed(1)} count=${referenceImages.length}`);

    const parts: Array<{ text: string } | { inlineData: InlineImage }> = [
      {
        text: `${prompt}\n\nUtilise imperativement aussi les images de reference produits jointes pour reproduire fidelement les vetements (coupe, matieres, motifs, details, couleurs).`,
      },
      ...referenceImages.map((image) => ({ inlineData: image })),
    ];

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    console.log(
      `[COST] image.call model=gemini-3-pro-image-preview keyAlias=${process.env.GEMINI_KEY_ALIAS || 'unknown'} aspectRatio=9:16 imageSize=1K`,
    );
    const tModelStart = this.nowMs();
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
    console.log(`[PERF] generateLookImage.modelCallMs=${(this.nowMs() - tModelStart).toFixed(1)}`);

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

    console.log(`[PERF] generateLookImage.totalMs=${(this.nowMs() - tStart).toFixed(1)}`);
    return imageUrl;
  }

  private static async loadReferenceImages(outfit: Product[]): Promise<InlineImage[]> {
    const loadedImages = await Promise.all(
      outfit.map(async (product) => {
        const inlineData = await this.fetchImageAsInlineData(product.image);
        if (!inlineData) {
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

  private static getProductExclusionKey(product: Product | CatalogProduct): string {
    const groupId = (product as CatalogProduct).variantGroupId?.trim().toLowerCase();
    if (groupId) return `group:${groupId}`;

    const brand = (product.brand || 'unknown').toLowerCase().trim();
    const category = (product.category || 'unknown').toLowerCase().trim();
    const titleBase = (product.title || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[, ](xxxl|xxl|xl|xs|s|m|l|\d{2,3}|\d+\/\d+)$/i, '')
      .trim();

    if (titleBase) return `fallback:${brand}|${category}|${titleBase}`;
    return `id:${product.id}`;
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
      return null;
    }
  }
}
