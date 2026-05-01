/**
 * Scryfall API adapter with rate limiting, retry logic, and response mapping.
 *
 * Enforces Scryfall's 2 requests/second guideline using a token-bucket
 * rate limiter with request queuing.
 */

import type { Card, CardFace, Color, ColorIdentity, SearchFilters } from "../models/card.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Shape returned by Scryfall list/search endpoints after mapping. */
export interface ScryfallSearchResult {
  cards: Card[];
  totalCards: number;
  hasMore: boolean;
  nextPageUrl?: string;
}

// ---------------------------------------------------------------------------
// Query builder (exported for property-based testing)
// ---------------------------------------------------------------------------

/**
 * Builds a Scryfall search query string from a base query, a commander's
 * color identity, and optional search filters.
 *
 * Scryfall syntax reference:
 *  - Color identity filter: `id<=wub`
 *  - Type filter:           `t:creature`
 *  - CMC filters:           `cmc>=3 cmc<=5`
 *  - Color filter:          `c:w`
 *  - Keyword filter:        `keyword:flying`
 */
export function buildSearchQuery(
  query: string,
  colorIdentity: ColorIdentity,
  filters?: SearchFilters,
): string {
  const parts: string[] = [query];

  // Color identity constraint — lowercase letters
  if (colorIdentity.length > 0) {
    const colors = colorIdentity.map((c) => c.toLowerCase()).join("");
    parts.push(`id<=${colors}`);
  } else {
    // Colorless commander — only colorless cards allowed
    parts.push(`id<=c`);
  }

  if (filters) {
    if (filters.cardType) {
      parts.push(`t:${filters.cardType}`);
    }
    if (filters.minCmc !== undefined && filters.minCmc !== null) {
      parts.push(`cmc>=${filters.minCmc}`);
    }
    if (filters.maxCmc !== undefined && filters.maxCmc !== null) {
      parts.push(`cmc<=${filters.maxCmc}`);
    }
    if (filters.colors && filters.colors.length > 0) {
      for (const color of filters.colors) {
        parts.push(`c:${color}`);
      }
    }
    if (filters.keywords && filters.keywords.length > 0) {
      for (const keyword of filters.keywords) {
        parts.push(`keyword:${keyword}`);
      }
    }
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

/**
 * Token-bucket rate limiter that allows at most `maxTokens` requests per
 * `intervalMs` milliseconds. Requests that exceed the limit are queued and
 * processed as tokens become available.
 */
class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly intervalMs: number;
  private lastRefill: number;
  private queue: QueuedRequest<unknown>[] = [];
  private processing = false;

  constructor(maxTokens = 2, intervalMs = 1000) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.intervalMs = intervalMs;
    this.lastRefill = Date.now();
  }

  /** Schedule a request through the rate limiter. */
  schedule<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: execute as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processQueue();
    });
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.intervalMs) {
      const refills = Math.floor(elapsed / this.intervalMs);
      this.tokens = Math.min(this.maxTokens, this.tokens + refills * this.maxTokens);
      this.lastRefill += refills * this.intervalMs;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      this.refillTokens();

      if (this.tokens > 0) {
        this.tokens -= 1;
        const item = this.queue.shift()!;
        try {
          const result = await item.execute();
          item.resolve(result);
        } catch (err) {
          item.reject(err);
        }
      } else {
        // Wait until the next token refill
        const waitMs = this.intervalMs - (Date.now() - this.lastRefill);
        await sleep(Math.max(waitMs, 50));
      }
    }

    this.processing = false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Scryfall response types (raw JSON shapes)
// ---------------------------------------------------------------------------

interface ScryfallCardJson {
  id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    art_crop: string;
  };
  card_faces?: ScryfallCardFaceJson[];
  legalities: Record<string, string>;
  keywords: string[];
}

interface ScryfallCardFaceJson {
  name: string;
  mana_cost: string;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    art_crop: string;
  };
}

interface ScryfallListJson {
  object: string;
  total_cards: number;
  has_more: boolean;
  next_page?: string;
  data: ScryfallCardJson[];
}

interface ScryfallAutocompleteJson {
  object: string;
  data: string[];
}

interface ScryfallCollectionJson {
  object: string;
  data: ScryfallCardJson[];
  not_found: { id: string }[];
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function toColor(s: string): Color | null {
  const upper = s.toUpperCase();
  if (upper === "W" || upper === "U" || upper === "B" || upper === "R" || upper === "G") {
    return upper as Color;
  }
  return null;
}

function mapColors(raw?: string[]): Color[] {
  if (!raw) return [];
  return raw.map(toColor).filter((c): c is Color => c !== null);
}

function mapImageUris(
  raw?: { small: string; normal: string; large: string; art_crop: string },
): Card["imageUris"] | undefined {
  if (!raw) return undefined;
  return {
    small: raw.small,
    normal: raw.normal,
    large: raw.large,
    artCrop: raw.art_crop,
  };
}

function mapCardFace(raw: ScryfallCardFaceJson): CardFace {
  return {
    name: raw.name,
    manaCost: raw.mana_cost ?? "",
    typeLine: raw.type_line,
    oracleText: raw.oracle_text ?? "",
    colors: mapColors(raw.colors),
    power: raw.power,
    toughness: raw.toughness,
    loyalty: raw.loyalty,
    imageUris: mapImageUris(raw.image_uris),
  };
}

/** Map a raw Scryfall card JSON object to the application `Card` model. */
export function mapScryfallCard(raw: ScryfallCardJson): Card {
  const typeLine = raw.type_line ?? "";
  const oracleText = raw.oracle_text ?? "";

  // For double-faced cards without top-level oracle_text, combine face texts
  const effectiveOracleText =
    oracleText ||
    (raw.card_faces ? raw.card_faces.map((f) => f.oracle_text ?? "").join("\n") : "");

  // For double-faced cards without top-level mana_cost, use front face
  const effectiveManaCost =
    raw.mana_cost ?? (raw.card_faces?.[0]?.mana_cost ?? "");

  const lowerType = typeLine.toLowerCase();
  const lowerOracle = effectiveOracleText.toLowerCase();

  const isLegendary = lowerType.includes("legendary");
  const isCreature = lowerType.includes("creature");
  const canBeCommander =
    (isLegendary && isCreature) || lowerOracle.includes("can be your commander");

  return {
    id: raw.id,
    name: raw.name,
    manaCost: effectiveManaCost,
    cmc: raw.cmc,
    typeLine,
    oracleText: effectiveOracleText,
    colors: mapColors(raw.colors),
    colorIdentity: mapColors(raw.color_identity),
    power: raw.power,
    toughness: raw.toughness,
    loyalty: raw.loyalty,
    imageUris: mapImageUris(raw.image_uris),
    cardFaces: raw.card_faces?.map(mapCardFace),
    legalities: raw.legalities,
    keywords: raw.keywords ?? [],
    isLegendary,
    isCreature,
    canBeCommander,
  };
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

export class ScryfallError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "ScryfallError";
  }
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff
// ---------------------------------------------------------------------------

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(input, init);

      // 4xx errors — do not retry (except 429 which we treat like 5xx)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        if (response.status === 404) {
          throw new ScryfallError("No results found.", response.status);
        }
        throw new ScryfallError(
          "Search error — please check your query.",
          response.status,
        );
      }

      // 5xx / 429 — retry with backoff
      if (response.status >= 500 || response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const backoff = INITIAL_BACKOFF_MS * Math.pow(3, attempt);
          await sleep(backoff);
          continue;
        }
        throw new ScryfallError(
          "Card search is temporarily unavailable. Please try again in a moment.",
          response.status,
        );
      }

      return response;
    } catch (err) {
      // Network / timeout errors — retry
      if (err instanceof ScryfallError) {
        throw err;
      }
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(3, attempt);
        await sleep(backoff);
        continue;
      }
    }
  }

  throw new ScryfallError(
    "Card search is temporarily unavailable. Please try again in a moment.",
  );
}

// ---------------------------------------------------------------------------
// ScryfallAdapter
// ---------------------------------------------------------------------------

export interface ScryfallAdapter {
  searchCommanders(query: string): Promise<ScryfallSearchResult>;
  searchCards(
    query: string,
    colorIdentity: ColorIdentity,
    filters?: SearchFilters,
  ): Promise<ScryfallSearchResult>;
  /** Search with a raw, pre-built Scryfall query string (no color identity added). */
  searchRaw(query: string): Promise<ScryfallSearchResult>;
  getCardById(id: string): Promise<Card>;
  autocomplete(query: string): Promise<string[]>;
  getNextPage(url: string): Promise<ScryfallSearchResult>;
  fetchCardCollection(ids: string[]): Promise<Card[]>;
}

export function createScryfallAdapter(): ScryfallAdapter {
  const limiter = new RateLimiter(2, 1000);

  async function fetchSearchResults(url: string): Promise<ScryfallSearchResult> {
    const response = await limiter.schedule(() => fetchWithRetry(url));
    const json: ScryfallListJson = await response.json();
    return {
      cards: json.data.map(mapScryfallCard),
      totalCards: json.total_cards,
      hasMore: json.has_more,
      nextPageUrl: json.next_page,
    };
  }

  return {
    async searchCommanders(query: string): Promise<ScryfallSearchResult> {
      const encoded = encodeURIComponent(`${query} is:commander`);
      const url = `https://api.scryfall.com/cards/search?q=${encoded}`;
      return fetchSearchResults(url);
    },

    async searchCards(
      query: string,
      colorIdentity: ColorIdentity,
      filters?: SearchFilters,
    ): Promise<ScryfallSearchResult> {
      const fullQuery = buildSearchQuery(query, colorIdentity, filters);
      const encoded = encodeURIComponent(fullQuery);
      const url = `https://api.scryfall.com/cards/search?q=${encoded}`;
      return fetchSearchResults(url);
    },

    async searchRaw(query: string): Promise<ScryfallSearchResult> {
      const encoded = encodeURIComponent(query);
      const url = `https://api.scryfall.com/cards/search?q=${encoded}&order=edhrec`;
      return fetchSearchResults(url);
    },

    async getCardById(id: string): Promise<Card> {
      const url = `https://api.scryfall.com/cards/${id}`;
      const response = await limiter.schedule(() => fetchWithRetry(url));
      const json: ScryfallCardJson = await response.json();
      return mapScryfallCard(json);
    },

    async autocomplete(query: string): Promise<string[]> {
      const encoded = encodeURIComponent(query);
      const url = `https://api.scryfall.com/cards/autocomplete?q=${encoded}`;
      const response = await limiter.schedule(() => fetchWithRetry(url));
      const json: ScryfallAutocompleteJson = await response.json();
      return json.data;
    },

    async getNextPage(url: string): Promise<ScryfallSearchResult> {
      return fetchSearchResults(url);
    },

    async fetchCardCollection(ids: string[]): Promise<Card[]> {
      const url = "https://api.scryfall.com/cards/collection";
      const body = JSON.stringify({
        identifiers: ids.map((id) => ({ id })),
      });
      const response = await limiter.schedule(() =>
        fetchWithRetry(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }),
      );
      const json: ScryfallCollectionJson = await response.json();
      return json.data.map(mapScryfallCard);
    },
  };
}
