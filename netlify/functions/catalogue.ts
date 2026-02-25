type JsonMap = Record<string, any>;

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
  fields?: any[];
  offers?: any[];
  categories?: any[];
  productImage?: any;
}

const SEARCH_URL = 'https://api.tradedoubler.com/1.0/products.json';
const UNLIMITED_URL = 'https://api.tradedoubler.com/1.0/productsUnlimited.json';
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 50;
const DEFAULT_START_PAGE = 1;
const DEFAULT_TARGET_PAGE_SIZE = 100;
const DEFAULT_TARGET_MAX_PAGES = 3;

function toArray(input: any): any[] {
  if (Array.isArray(input)) return input;
  return [];
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function pickFirstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const s = asString(value);
    if (s) return s;
  }
  return undefined;
}

function pickFieldValue(fields: any, key: string): string | undefined {
  const arr = toArray(fields);
  const found = arr.find((field: any) => field?.name === key);
  return asString(found?.value);
}

function pickOfferPrice(offer: any): number | string | undefined {
  const history = toArray(offer?.priceHistory);
  const last = history[history.length - 1];
  return asNumber(last?.price?.value) ?? pickFirstString(last?.price?.value);
}

function pickOfferCurrency(offer: any): string | undefined {
  const history = toArray(offer?.priceHistory);
  const last = history[history.length - 1];
  return pickFirstString(last?.price?.currency);
}

function pickCategory(product: JsonMap): string {
  const categories = toArray(product.categories);
  const firstCategory = categories[0];
  const fields = product.fields;
  return (
    pickFirstString(
      product.productType,
      product.product_type,
      product.googleProductCategory,
      product.google_product_category,
      pickFieldValue(fields, 'g:product_type'),
      pickFieldValue(fields, 'product_type'),
      pickFieldValue(fields, 'productType'),
      pickFieldValue(fields, 'g:google_product_category'),
      product.category,
      product.categoryName,
      firstCategory?.name,
      firstCategory?.categoryName,
      firstCategory?.path,
    ) || 'Unknown'
  );
}

function pickImage(product: JsonMap): string | undefined {
  const images = toArray(product.images);
  const firstImage = images[0];
  const fields = product.fields;
  return pickFirstString(
    product.image,
    product.imageUrl,
    product.productImage?.url,
    firstImage?.url,
    firstImage?.imageUrl,
    pickFieldValue(fields, 'g:additional_image_link'),
  );
}

function pickPrice(product: JsonMap): number | string | undefined {
  return (
    asNumber(product.price?.value) ??
    asNumber(product.price?.amount) ??
    asNumber(product.priceValue) ??
    asNumber(product.salePrice) ??
    asNumber(product.price) ??
    pickFirstString(product.price?.value, product.price?.amount, product.salePrice)
  );
}

function pickCurrency(product: JsonMap): string | undefined {
  return pickFirstString(product.price?.currency, product.currency, product.currencyCode, 'EUR');
}

function mapToLegacyProduct(product: JsonMap): LegacyProduct | null {
  const fields = product.fields;
  const offers = toArray(product.offers);
  const primaryOffer = offers[0];
  const baseId = pickFirstString(
    product.id,
    product.productId,
    product.sku,
    product.ean,
    product.gtin,
    pickFieldValue(fields, 'ProductoID'),
    pickFieldValue(fields, 'g:mpn'),
  );
  const title = pickFirstString(product.name, product.productName, product.title);
  const image = pickImage(product);
  const affiliateUrl = pickFirstString(
    product.productUrl,
    product.url,
    product.deeplink,
    product.affiliateUrl,
    primaryOffer?.productUrl,
  );
  const salePrice = pickFieldValue(fields, 'Sale price');
  const price =
    pickPrice(product) ??
    (salePrice ? asNumber(salePrice) ?? salePrice : undefined) ??
    pickOfferPrice(primaryOffer);

  if (!baseId || !title || !price) return null;

  const uniqueId = `${baseId}|${affiliateUrl || ''}|${String(price)}|${title}`;

  return {
    id: uniqueId,
    title,
    name: title,
    description: pickFirstString(product.description, product.shortDescription),
    brand: pickFirstString(product.brand?.name, product.brand, 'Unknown'),
    image,
    affiliateUrl,
    price,
    currency: pickCurrency(product) || pickOfferCurrency(primaryOffer) || 'EUR',
    category: pickCategory(product),
    availability: pickFirstString(
      product.availability,
      product.stockStatus,
      product.inStock ? 'in stock' : undefined,
      primaryOffer?.availability,
    ),
    // Keep source structures for downstream normalizers.
    ...(Array.isArray(product.fields) ? { fields: product.fields } : {}),
    ...(Array.isArray(product.offers) ? { offers: product.offers } : {}),
    ...(Array.isArray(product.categories) ? { categories: product.categories } : {}),
    ...(product.productImage ? { productImage: product.productImage } : {}),
  };
}

function extractProducts(payload: any): JsonMap[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.result?.products)) return payload.result.products;
  if (Array.isArray(payload?.result?.items)) return payload.result.items;
  return [];
}

function buildTdUrl(
  baseUrl: string,
  fid: string,
  token: string,
  page: number,
  pageSize: number,
  extraParams: URLSearchParams,
  mode: 'targeted' | 'full',
): string {
  const matrixParts: string[] = [];
  extraParams.forEach((value, key) => {
    matrixParts.push(`;${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  });
  matrixParts.push(`;fid=${encodeURIComponent(fid)}`);
  if (mode === 'full') {
    matrixParts.push(`;page=${encodeURIComponent(String(page))}`);
    matrixParts.push(`;pageSize=${encodeURIComponent(String(pageSize))}`);
  }
  return `${baseUrl}${matrixParts.join('')}?token=${encodeURIComponent(token)}`;
}

async function fetchPage(
  baseUrl: string,
  fid: string,
  token: string,
  page: number,
  pageSize: number,
  extraParams: URLSearchParams,
  mode: 'targeted' | 'full',
): Promise<{ items: LegacyProduct[]; rawCount: number }> {
  const url = buildTdUrl(baseUrl, fid, token, page, pageSize, extraParams, mode);
  console.log(`[TD] GET ${url.replace(token, '***')}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`TradeDoubler HTTP ${response.status} on fid=${fid}, page=${page}`);
  }

  const payload = await response.json();
  const products = extractProducts(payload);
  const normalized = products.map(mapToLegacyProduct).filter((item): item is LegacyProduct => item !== null);
  return {
    rawCount: products.length,
    items: normalized,
  };
}

function dedupeById(items: LegacyProduct[]): LegacyProduct[] {
  const map = new Map<string, LegacyProduct>();
  for (const item of items) {
    if (!item.id) continue;
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

function parseFidsFromEnv(): string[] {
  const list = (process.env.TD_FIDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (list.length > 0) return list;
  if (process.env.TD_FID && process.env.TD_FID.trim()) return [process.env.TD_FID.trim()];
  return [];
}

function pickQueryParams(event: any): URLSearchParams {
  const allowed = new Set([
    'q',
    'category',
    'brand',
    'language',
    'availability',
    'minPrice',
    'maxPrice',
    'orderBy',
  ]);
  const params = new URLSearchParams();
  const input = event?.queryStringParameters || {};
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) continue;
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      params.append(key, value.trim());
    }
  }
  return params;
}

export const handler = async (event: any) => {
  try {
    const fids = parseFidsFromEnv();
    const token = process.env.TD_TOKEN;

    if (fids.length === 0 || !token) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'TD_TOKEN and TD_FID or TD_FIDS must be set in environment variables',
        }),
      };
    }

    const pageSize = Math.max(20, Number(process.env.TD_PAGE_SIZE || DEFAULT_PAGE_SIZE));
    const maxPages = Math.max(20, Number(process.env.TD_MAX_PAGES || DEFAULT_MAX_PAGES));
    const startPage = Math.max(1, Number(process.env.TD_START_PAGE || DEFAULT_START_PAGE));
    const requestedPageSize = Number(event?.queryStringParameters?.pageSize || '');
    const requestedMaxPages = Number(event?.queryStringParameters?.maxPages || '');
    const extraParams = pickQueryParams(event);
    const targeted = extraParams.toString().length > 0;
    const effectivePageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
      ? Math.min(500, Math.max(20, requestedPageSize))
      : targeted
        ? Math.max(20, Number(process.env.TD_TARGET_PAGE_SIZE || DEFAULT_TARGET_PAGE_SIZE))
        : pageSize;
    const effectiveMaxPages = Number.isFinite(requestedMaxPages) && requestedMaxPages > 0
      ? Math.min(20, Math.max(1, requestedMaxPages))
      : targeted
        ? 1
        : maxPages;
    const mode: 'targeted' | 'full' = targeted ? 'targeted' : 'full';
    const baseUrl = targeted ? SEARCH_URL : UNLIMITED_URL;
    console.log(
      `[TD] Pagination config mode=${targeted ? 'targeted' : 'full'} endpoint=${baseUrl} pageSize=${effectivePageSize} maxPages=${effectiveMaxPages} startPage=${startPage} fids=${fids.join(
        ',',
      )} query=${extraParams.toString() || 'none'}`,
    );

    const allProducts: LegacyProduct[] = [];
    for (const fid of fids) {
      for (let page = startPage; page < startPage + effectiveMaxPages; page += 1) {
        const pageData = await fetchPage(baseUrl, fid, token, page, effectivePageSize, extraParams, mode);
        const withScopedId = pageData.items.map((item) => ({
          ...item,
          id: item.id ? `${fid}:${item.id}` : item.id,
        }));
        console.log(`[TD][fid=${fid}] page=${page} rawCount=${pageData.rawCount} normalized=${withScopedId.length}`);
        if (pageData.rawCount === 0) break;
        allProducts.push(...withScopedId);
        if (pageData.rawCount < effectivePageSize) break;
      }
    }

    const deduped = dedupeById(allProducts);
    console.log(`[TD] dedupe before=${allProducts.length} after=${deduped.length}`);
    console.log(`[TD] Returning ${deduped.length} normalized products from function`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
      body: JSON.stringify({ products: deduped }),
    };
  } catch (error) {
    console.log(`[TD] Function failed: ${String(error)}`);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to load TradeDoubler catalogue',
        detail: String(error),
      }),
    };
  }
};
