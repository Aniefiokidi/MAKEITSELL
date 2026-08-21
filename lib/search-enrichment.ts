import { Product as ProductModel } from './models/Product';
import { getProducts, countProducts, getServices, ServiceModel } from './mongodb-operations';

// Ported from the website's components/search/SearchResults.tsx, which proved this
// algorithm/threshold out client-side first — moved here so both the website and the
// mobile app get the same "did you mean" + "similar items" behavior from one place,
// computed server-side instead of each client fetching a large unfiltered sample to
// score in-browser.

export function levenshteinDistance(a: string, b: string): number {
  const source = a.toLowerCase();
  const target = b.toLowerCase();
  const matrix: number[][] = Array.from({ length: source.length + 1 }, () => Array(target.length + 1).fill(0));

  for (let i = 0; i <= source.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= target.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= source.length; i += 1) {
    for (let j = 1; j <= target.length; j += 1) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[source.length][target.length];
}

export function buildQueryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function dedupeTerms(terms: unknown[]): string[] {
  return Array.from(
    new Set(
      terms
        .filter(Boolean)
        .map((term) => String(term).trim())
        .filter((term) => term.length > 2)
    )
  ).slice(0, 1000); // bounds worst-case Levenshtein cost regardless of catalog growth
}

function findClosestTerm(query: string, candidateTerms: string[]): string | null {
  let closest: string | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const term of candidateTerms) {
    const distance = levenshteinDistance(query, term);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = term;
    }
  }
  if (
    closest &&
    closest.toLowerCase() !== query.toLowerCase() &&
    closestDistance <= Math.max(2, Math.floor(query.length * 0.35))
  ) {
    return closest;
  }
  return null;
}

function scoreProduct(product: any, tokens: string[]): number {
  const title = String(product?.name || product?.title || '').toLowerCase();
  const description = String(product?.description || '').toLowerCase();
  const category = String(product?.category || '').toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 3;
    if (category.includes(token)) score += 2;
    if (description.includes(token)) score += 1;
  }

  const sales = Number(product?.sales || 0);
  const stock = Number(product?.stock || 0);
  score +=
    Math.min(sales, 200) / 12 +
    (stock > 0 ? 1.5 : -1.5) +
    (product?.featured ? 2.5 : 0);

  return score;
}

function scoreService(service: any, tokens: string[]): number {
  // Unlike products, `rating`/`reviews` are declared on the Service TS interface but
  // never actually populated by getServices() — no popularity signal exists beyond
  // `featured`, so this only scores on text relevance + featured, not invented numbers.
  const title = String(service?.title || service?.name || '').toLowerCase();
  const description = String(service?.description || '').toLowerCase();
  const category = String(service?.category || '').toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 3;
    if (category.includes(token)) score += 2;
    if (description.includes(token)) score += 1;
  }
  score += service?.featured ? 2.5 : 0;

  return score;
}

export interface SearchSuggestion {
  term: string;
  resultCount: number;
}

export interface SearchEnrichment {
  suggestion?: SearchSuggestion;
  similar?: any[];
}

// Tier 2 popularity-pool fallback shared by both product/service enrichment — same
// filters minus vendor/city scope (a city filter is often *why* a search came back
// empty; reusing that scope here would guarantee the fallback is empty too), scored
// against the raw query's tokens, falling back further to just-featured, then just
// "whatever's in the pool" if literally nothing scores.
function rankPool<T>(pool: T[], tokens: string[], score: (item: T, tokens: string[]) => number): T[] {
  const scored = pool
    .map((item) => ({ item, score: score(item, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((entry) => entry.item);
  if (scored.length > 0) return scored;

  const featured = pool.filter((item: any) => Boolean(item?.featured)).slice(0, 8);
  return featured.length > 0 ? featured : pool.slice(0, 8);
}

export async function getProductSearchEnrichment(query: string, filters: any): Promise<SearchEnrichment> {
  const [names, categories, subcategories, vendors] = await Promise.all([
    ProductModel.distinct('name'),
    ProductModel.distinct('category'),
    ProductModel.distinct('subcategory'),
    ProductModel.distinct('vendorName'),
  ]);
  const candidateTerms = dedupeTerms([...names, ...categories, ...subcategories, ...vendors]);
  const term = findClosestTerm(query, candidateTerms);

  let similar: any[] = [];
  let resultCountForTerm = 0;

  if (term) {
    const correctedResults = await getProducts({ ...filters, search: term, skipCount: 0, limitCount: 8 });
    if (correctedResults.length > 0) {
      similar = correctedResults;
      resultCountForTerm = await countProducts({ ...filters, search: term });
    }
  }

  if (similar.length === 0) {
    const pool = await getProducts({
      category: filters?.category,
      minPrice: filters?.minPrice,
      maxPrice: filters?.maxPrice,
      status: 'active',
      sortBy: 'featured',
      limitCount: 30,
    });
    similar = rankPool(pool, buildQueryTokens(query), scoreProduct);
  }

  return {
    suggestion: term ? { term, resultCount: resultCountForTerm } : undefined,
    similar: similar.length > 0 ? similar : undefined,
  };
}

export async function getServiceSearchEnrichment(query: string, filters: any): Promise<SearchEnrichment> {
  const [titles, categories, subcategories, providers] = await Promise.all([
    ServiceModel.distinct('title'),
    ServiceModel.distinct('category'),
    ServiceModel.distinct('subcategory'),
    ServiceModel.distinct('providerName'),
  ]);
  const candidateTerms = dedupeTerms([...titles, ...categories, ...subcategories, ...providers]);
  const term = findClosestTerm(query, candidateTerms);

  let similar: any[] = [];
  let resultCountForTerm = 0;

  if (term) {
    const correctedResults = await getServices({ ...filters, search: term, skipCount: 0, limitCount: 8 });
    if (correctedResults.length > 0) {
      similar = correctedResults;
      resultCountForTerm = correctedResults.length;
    }
  }

  if (similar.length === 0) {
    const pool = await getServices({
      category: filters?.category,
      status: 'active',
      limitCount: 30,
    });
    similar = rankPool(pool, buildQueryTokens(query), scoreService);
  }

  return {
    suggestion: term ? { term, resultCount: resultCountForTerm } : undefined,
    similar: similar.length > 0 ? similar : undefined,
  };
}
