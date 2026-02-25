const TD_UNLIMITED_URL = 'https://api.tradedoubler.com/1.0/productsUnlimited.json';

const TD_SLOT_KEYWORDS: Record<string, string[]> = {
  top: ['top', 't-shirt', 'shirt', 'blouse', 'pullover', 'sweater'],
  bottom: ['trouser', 'trousers', 'pants', 'jean', 'skirt', 'short'],
  outerwear: ['jacket', 'coat', 'parka', 'blazer', 'trench'],
  shoes: ['shoe', 'shoes', 'sneaker', 'sneakers', 'sandals', 'boots'],
  accessory: ['bag', 'belt', 'scarf', 'hat', 'cap'],
};

function parseFidsFromEnv(): string[] {
  const list = (process.env.TD_FIDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (list.length > 0) return list;
  if (process.env.TD_FID && process.env.TD_FID.trim()) return [process.env.TD_FID.trim()];
  return [];
}

function extractProducts(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.result?.products)) return payload.result.products;
  if (Array.isArray(payload?.result?.items)) return payload.result.items;
  return [];
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

async function tdSampleProducts(fid: string, token: string, samplePages = 2, pageSize = 200): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= samplePages; page += 1) {
    const url = `${TD_UNLIMITED_URL};fid=${encodeURIComponent(fid)};page=${page};pageSize=${pageSize}?token=${encodeURIComponent(
      token,
    )}`;
    const payload = await tdFetchJson(url);
    const products = extractProducts(payload);
    all.push(...products);
    if (products.length < pageSize) break;
  }
  return all;
}

export const handler = async (event: any) => {
  try {
    const token = process.env.TD_TOKEN;
    const fids = parseFidsFromEnv();
    const fid = event?.queryStringParameters?.fid || fids[0];
    if (!token || !fid) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'TD_TOKEN and TD_FID/TD_FIDS are required' }),
      };
    }

    const slot = (event?.queryStringParameters?.slot || 'top').toLowerCase();
    const budget = Number(event?.queryStringParameters?.budget || 0);
    const style = (event?.queryStringParameters?.style || '').trim();
    const usage = (event?.queryStringParameters?.usage || '').trim();
    const samplePages = Math.max(1, Number(event?.queryStringParameters?.samplePages || 2));
    const sampledProducts = await tdSampleProducts(fid, token, samplePages);

    const termCounts: Record<string, number> = {};
    for (const product of sampledProducts) {
      const category = product?.categories?.[0]?.name || product?.category || product?.productType || '';
      const title = product?.name || product?.title || '';
      const text = `${category} ${title}`.toLowerCase();
      if (tdInferSlot(text) !== slot) continue;
      for (const keyword of TD_SLOT_KEYWORDS[slot] || []) {
        if (!text.includes(keyword)) continue;
        termCounts[keyword] = (termCounts[keyword] || 0) + 1;
      }
    }

    const recommendedTerms = Object.entries(termCounts)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const suggestedQueries = recommendedTerms.slice(0, 8).map((item) => {
      const params = new URLSearchParams();
      params.append('q', item.term);
      if (style) params.append('q', style);
      if (usage) params.append('q', usage);
      if (budget > 0) params.set('maxPrice', String(budget));
      params.set('pageSize', '100');
      params.set('maxPages', '1');
      return params.toString();
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fid,
        slot,
        sampledProducts: sampledProducts.length,
        recommendedTerms,
        suggestedQueries,
      }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to build TD query suggestions', detail: String(error) }),
    };
  }
};

