import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const ALLOWED_IMAGE_HOSTS = new Set([
  'www.desigual.com',
  'desigual.com',
]);

const TD_SEARCH_URL = 'https://api.tradedoubler.com/1.0/products.json';
const TD_UNLIMITED_URL = 'https://api.tradedoubler.com/1.0/productsUnlimited.json';
const TD_PRODUCT_FEEDS_URL = 'https://api.tradedoubler.com/1.0/productFeeds';
const TD_PRODUCT_CATEGORIES_URL = 'https://api.tradedoubler.com/1.0/productCategories.json';
const TD_DEFAULT_START_PAGE = 1;
const TD_SLOT_KEYWORDS: Record<string, string[]> = {
  top: ['top', 't-shirt', 'shirt', 'blouse', 'pullover', 'sweater'],
  bottom: ['trouser', 'trousers', 'pants', 'jean', 'skirt', 'short'],
  outerwear: ['jacket', 'coat', 'parka', 'blazer', 'trench'],
  shoes: ['shoe', 'shoes', 'sneaker', 'sneakers', 'sandals', 'boots'],
  accessory: ['bag', 'belt', 'scarf', 'hat', 'cap'],
};

function tdPickFirstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function tdPickImage(product: any): string | undefined {
  const images = Array.isArray(product?.images) ? product.images : [];
  const firstImage = images[0];
  return tdPickFirstString(
    product?.image,
    product?.imageUrl,
    product?.productImage?.url,
    firstImage?.url,
    firstImage?.imageUrl,
  );
}

function tdPickFieldValue(fields: any, key: string): string | undefined {
  const arr = Array.isArray(fields) ? fields : [];
  const found = arr.find((field: any) => field?.name === key);
  return tdPickFirstString(found?.value);
}

function tdPickOfferPrice(offer: any): number | string | undefined {
  const history = Array.isArray(offer?.priceHistory) ? offer.priceHistory : [];
  const last = history[history.length - 1];
  return last?.price?.value ?? undefined;
}

function tdPickOfferCurrency(offer: any): string | undefined {
  const history = Array.isArray(offer?.priceHistory) ? offer.priceHistory : [];
  const last = history[history.length - 1];
  return tdPickFirstString(last?.price?.currency);
}

function tdMapProduct(product: any) {
  const categories = Array.isArray(product?.categories) ? product.categories : [];
  const firstCategory = categories[0];
  const fields = product?.fields;
  const offers = Array.isArray(product?.offers) ? product.offers : [];
  const primaryOffer = offers[0];
  const baseId = tdPickFirstString(
    product?.id,
    product?.productId,
    product?.sku,
    product?.ean,
    product?.gtin,
    tdPickFieldValue(fields, 'ProductoID'),
    tdPickFieldValue(fields, 'g:mpn'),
  );
  const title = tdPickFirstString(product?.name, product?.productName, product?.title);
  const salePrice = tdPickFieldValue(fields, 'Sale price');
  const price =
    product?.price?.value ??
    product?.price?.amount ??
    product?.priceValue ??
    product?.salePrice ??
    product?.price ??
    salePrice ??
    tdPickOfferPrice(primaryOffer);

  if (!baseId || !title || price == null) return null;

  const affiliateUrl = tdPickFirstString(
    product?.productUrl,
    product?.url,
    product?.deeplink,
    product?.affiliateUrl,
    primaryOffer?.productUrl,
  );
  const uniqueId = `${baseId}|${affiliateUrl || ''}|${String(price)}|${title}`;

  return {
    id: uniqueId,
    title,
    name: title,
    description: tdPickFirstString(product?.description, product?.shortDescription),
    brand: tdPickFirstString(product?.brand?.name, product?.brand, 'Unknown'),
    image: tdPickImage(product),
    affiliateUrl,
    price,
    currency: tdPickFirstString(product?.price?.currency, product?.currency, product?.currencyCode, tdPickOfferCurrency(primaryOffer), 'EUR'),
    category: tdPickFirstString(
      product?.productType,
      product?.product_type,
      product?.googleProductCategory,
      product?.google_product_category,
      tdPickFieldValue(product?.fields, 'g:product_type'),
      tdPickFieldValue(product?.fields, 'product_type'),
      tdPickFieldValue(product?.fields, 'productType'),
      tdPickFieldValue(product?.fields, 'g:google_product_category'),
      product?.category,
      product?.categoryName,
      firstCategory?.name,
      firstCategory?.path,
    ) || 'Unknown',
    availability: tdPickFirstString(
      product?.availability,
      product?.stockStatus,
      product?.inStock ? 'in stock' : undefined,
      primaryOffer?.availability,
    ),
    fields: Array.isArray(product?.fields) ? product.fields : undefined,
    offers: Array.isArray(product?.offers) ? product.offers : undefined,
    categories: Array.isArray(product?.categories) ? product.categories : undefined,
    productImage: product?.productImage,
  };
}

function tdExtractProducts(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.result?.products)) return payload.result.products;
  if (Array.isArray(payload?.result?.items)) return payload.result.items;
  return [];
}

function tdParseFids(env: Record<string, string>): string[] {
  const fids = (env.TD_FIDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (fids.length > 0) return fids;
  if (env.TD_FID && env.TD_FID.trim()) return [env.TD_FID.trim()];
  return [];
}

function tdBuildUrl(
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

function tdPickExtraParams(reqUrl: URL): URLSearchParams {
  const allowed = new Set(['q', 'category', 'brand', 'language', 'availability', 'minPrice', 'maxPrice', 'orderBy']);
  const params = new URLSearchParams();
  reqUrl.searchParams.forEach((value, key) => {
    if (!allowed.has(key)) return;
    if (value && value.trim()) params.append(key, value.trim());
  });
  return params;
}

async function tdFetchJson(url: string): Promise<any> {
  const upstream = await fetch(url, { headers: { accept: 'application/json' } });
  if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
  return upstream.json();
}

function tdInferSlot(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [slot, keywords] of Object.entries(TD_SLOT_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) return slot;
  }
  return null;
}

function tdBuildTaxonomySummary(products: any[]) {
  const slotDistribution: Record<string, number> = { top: 0, bottom: 0, outerwear: 0, shoes: 0, accessory: 0 };
  const termsBySlot: Record<string, Record<string, number>> = {
    top: {},
    bottom: {},
    outerwear: {},
    shoes: {},
    accessory: {},
  };

  for (const product of products) {
    const category = tdPickFirstString(
      product?.categories?.[0]?.name,
      product?.category,
      product?.productType,
      product?.googleProductCategory,
    ) || '';
    const title = tdPickFirstString(product?.name, product?.title) || '';
    const text = `${category} ${title}`.toLowerCase();
    const slot = tdInferSlot(text);
    if (!slot) continue;
    slotDistribution[slot] += 1;
    for (const keyword of TD_SLOT_KEYWORDS[slot]) {
      if (!text.includes(keyword)) continue;
      termsBySlot[slot][keyword] = (termsBySlot[slot][keyword] || 0) + 1;
    }
  }

  const sortedTermsBySlot: Record<string, Array<{ term: string; count: number }>> = {};
  for (const slot of Object.keys(termsBySlot)) {
    sortedTermsBySlot[slot] = Object.entries(termsBySlot[slot])
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }

  return { slotDistribution, termsBySlot: sortedTermsBySlot };
}

async function tdSampleProducts(fid: string, token: string, samplePages = 2, pageSize = 200): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= samplePages; page += 1) {
    const url = `${TD_UNLIMITED_URL};fid=${encodeURIComponent(fid)};page=${page};pageSize=${pageSize}?token=${encodeURIComponent(
      token,
    )}`;
    const payload = await tdFetchJson(url);
    const products = tdExtractProducts(payload);
    all.push(...products);
    if (products.length < pageSize) break;
  }
  return all;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const geminiApiKey =
    mode === 'production'
      ? env.GEMINI_API_KEY_PROD || env.GEMINI_API_KEY || ''
      : env.GEMINI_API_KEY_DEV || env.GEMINI_API_KEY || '';
  const geminiKeyAlias = env.GEMINI_KEY_ALIAS || (mode === 'production' ? 'prod' : 'dev');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'local-image-proxy',
        configureServer(server) {
          server.middlewares.use('/api/td-taxonomy', async (req, res) => {
            try {
              const reqUrl = new URL(req.url || '', 'http://localhost');
              const token = env.TD_TOKEN;
              const fids = tdParseFids(env as any);
              const fid = reqUrl.searchParams.get('fid') || fids[0];
              if (!token || !fid) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing TD_TOKEN and TD_FID/TD_FIDS in .env.local' }));
                return;
              }

              const language = reqUrl.searchParams.get('language') || 'en';
              const feedsUrl = `${TD_PRODUCT_FEEDS_URL}/${encodeURIComponent(fid)}.json?token=${encodeURIComponent(token)}`;
              const categoriesUrl = `${TD_PRODUCT_CATEGORIES_URL};language=${encodeURIComponent(
                language,
              )}?token=${encodeURIComponent(token)}`;
              const [feedPayload, categoriesPayload, sampledProducts] = await Promise.all([
                tdFetchJson(feedsUrl).catch(() => null),
                tdFetchJson(categoriesUrl).catch(() => null),
                tdSampleProducts(fid, token, Number(reqUrl.searchParams.get('samplePages') || 2)),
              ]);

              const summary = tdBuildTaxonomySummary(sampledProducts);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  fid,
                  language,
                  sampledProducts: sampledProducts.length,
                  feed: feedPayload?.feeds?.[0] || null,
                  taxonomy: categoriesPayload || null,
                  summary,
                }),
              );
            } catch (error) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Failed to build TD taxonomy', detail: String(error) }));
            }
          });

          server.middlewares.use('/api/td-query-builder', async (req, res) => {
            try {
              const reqUrl = new URL(req.url || '', 'http://localhost');
              const token = env.TD_TOKEN;
              const fids = tdParseFids(env as any);
              const fid = reqUrl.searchParams.get('fid') || fids[0];
              const slot = (reqUrl.searchParams.get('slot') || 'top').toLowerCase();
              if (!token || !fid) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing TD_TOKEN and TD_FID/TD_FIDS in .env.local' }));
                return;
              }

              const sampledProducts = await tdSampleProducts(fid, token, Number(reqUrl.searchParams.get('samplePages') || 2));
              const summary = tdBuildTaxonomySummary(sampledProducts);
              const slotTerms = summary.termsBySlot[slot] || [];
              const budget = Number(reqUrl.searchParams.get('budget') || 0);
              const style = (reqUrl.searchParams.get('style') || '').trim();
              const usage = (reqUrl.searchParams.get('usage') || '').trim();
              const paramsList = slotTerms.slice(0, 8).map((item: any) => {
                const params = new URLSearchParams();
                params.append('q', item.term);
                if (style) params.append('q', style);
                if (usage) params.append('q', usage);
                if (budget > 0) params.set('maxPrice', String(budget));
                params.set('pageSize', '100');
                params.set('maxPages', '1');
                return params.toString();
              });

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  fid,
                  slot,
                  sampledProducts: sampledProducts.length,
                  slotDistribution: summary.slotDistribution,
                  recommendedTerms: slotTerms,
                  suggestedQueries: paramsList,
                }),
              );
            } catch (error) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Failed to build TD query suggestions', detail: String(error) }));
            }
          });

          server.middlewares.use('/api/catalogue', async (req, res) => {
            try {
              const tStart = Date.now();
              const reqUrl = new URL(req.url || '', 'http://localhost');
              const token = env.TD_TOKEN;
              const fids = tdParseFids(env as any);
              if (!token || fids.length === 0) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing TD_TOKEN and TD_FID/TD_FIDS in .env.local' }));
                return;
              }

              const pageSize = Math.max(20, Number(env.TD_PAGE_SIZE || 100));
              const maxPages = Math.max(20, Number(env.TD_MAX_PAGES || 50));
              const startPage = Math.max(1, Number(env.TD_START_PAGE || TD_DEFAULT_START_PAGE));
              const extraParams = tdPickExtraParams(reqUrl);
              const targeted = extraParams.toString().length > 0;
              const requestedPageSize = Number(reqUrl.searchParams.get('pageSize') || '');
              const requestedMaxPages = Number(reqUrl.searchParams.get('maxPages') || '');
              const effectivePageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
                ? Math.min(500, Math.max(20, requestedPageSize))
                : targeted
                  ? Math.max(20, Number(env.TD_TARGET_PAGE_SIZE || 100))
                  : pageSize;
              const effectiveMaxPages = Number.isFinite(requestedMaxPages) && requestedMaxPages > 0
                ? Math.min(20, Math.max(1, requestedMaxPages))
                : targeted
                  ? 1
                  : maxPages;
              const mode: 'targeted' | 'full' = targeted ? 'targeted' : 'full';
              const baseUrl = targeted ? TD_SEARCH_URL : TD_UNLIMITED_URL;
              const allProducts: any[] = [];
              console.log(
                `[TD] Pagination config mode=${targeted ? 'targeted' : 'full'} endpoint=${baseUrl} pageSize=${effectivePageSize} maxPages=${effectiveMaxPages} startPage=${startPage} fids=${fids.join(
                  ',',
                )} query=${extraParams.toString() || 'none'}`,
              );

              for (const fid of fids) {
                for (let page = startPage; page < startPage + effectiveMaxPages; page += 1) {
                  const url = tdBuildUrl(baseUrl, fid, token, page, effectivePageSize, extraParams, mode);
                  console.log(`[TD] GET ${url.replace(token, '***')}`);
                  const upstream = await fetch(url, {
                    headers: { accept: 'application/json' },
                  });
                  if (!upstream.ok) {
                    res.statusCode = upstream.status;
                    res.end(`TradeDoubler error: HTTP ${upstream.status} on fid=${fid}, page=${page}`);
                    return;
                  }

                  const payload = await upstream.json();
                  const rawProducts = tdExtractProducts(payload);
                  const pageProducts = rawProducts
                    .map(tdMapProduct)
                    .filter(Boolean)
                    .map((item: any) => ({ ...item, id: item?.id ? `${fid}:${item.id}` : item?.id }));

                  console.log(`[TD][fid=${fid}] page=${page} rawCount=${rawProducts.length} normalized=${pageProducts.length}`);

                  if (rawProducts.length === 0) break;
                  allProducts.push(...pageProducts);
                  if (rawProducts.length < effectivePageSize) break;
                }
              }

              const byId = new Map<string, any>();
              for (const product of allProducts) {
                if (product?.id && !byId.has(product.id)) byId.set(product.id, product);
              }
              console.log(`[TD] dedupe before=${allProducts.length} after=${byId.size}`);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'public, max-age=300');
              console.log(`[TD] Returning ${byId.size} normalized products from /api/catalogue`);
              console.log(`[PERF] /api/catalogue totalMs=${Date.now() - tStart}`);
              res.end(JSON.stringify({ products: [...byId.values()] }));
            } catch (error) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              console.log(`[TD] /api/catalogue failed: ${String(error)}`);
              console.log(`[PERF] /api/catalogue totalMs=error`);
              res.end(JSON.stringify({ error: 'Failed to proxy TradeDoubler catalogue', detail: String(error) }));
            }
          });

          server.middlewares.use('/api/image-proxy', async (req, res) => {
            try {
              const reqUrl = new URL(req.url || '', 'http://localhost');
              const targetUrl = reqUrl.searchParams.get('url');

              if (!targetUrl) {
                res.statusCode = 400;
                res.end('Missing url query parameter');
                return;
              }

              let parsedTarget: URL;
              try {
                parsedTarget = new URL(targetUrl);
              } catch {
                res.statusCode = 400;
                res.end('Invalid target url');
                return;
              }

              if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
                res.statusCode = 400;
                res.end('Unsupported protocol');
                return;
              }

              if (!ALLOWED_IMAGE_HOSTS.has(parsedTarget.hostname)) {
                res.statusCode = 403;
                res.end('Host not allowed');
                return;
              }

              const upstream = await fetch(parsedTarget.toString(), {
                headers: {
                  'user-agent': 'Mozilla/5.0 (compatible; StylisteVirtuel/1.0)',
                  accept: 'image/*,*/*;q=0.8',
                },
              });

              if (!upstream.ok) {
                res.statusCode = upstream.status;
                res.end(`Upstream error: HTTP ${upstream.status}`);
                return;
              }

              const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
              const bytes = Buffer.from(await upstream.arrayBuffer());

              res.statusCode = 200;
              res.setHeader('Content-Type', contentType);
              res.setHeader('Cache-Control', 'public, max-age=3600');
              res.end(bytes);
            } catch (error) {
              res.statusCode = 500;
              res.end(`Proxy error: ${String(error)}`);
            }
          });
        },
      },
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(geminiApiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
      'process.env.GEMINI_KEY_ALIAS': JSON.stringify(geminiKeyAlias),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
