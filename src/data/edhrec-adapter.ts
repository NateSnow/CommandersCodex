/**
 * EDHREC adapter for fetching commander card recommendations and average decks.
 *
 * Uses two EDHREC JSON endpoints:
 * 1. Commander page: synergy scores, inclusion rates for individual cards
 * 2. Average deck page: a complete 100-card decklist aggregated from real decks
 *
 * These are community-known endpoints, not an official API.
 */

import type { EDHRECRecommendation } from "../models/recommendation.js";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/** A card from the EDHREC average deck, with its Scryfall UUID and quantity. */
export interface EDHRECAverageDeckCard {
  scryfallId: string;
  name: string;
  quantity: number;
  category: string;  // "creatures", "instants", "sorceries", "artifacts", "enchantments", "planeswalkers", "lands", "basics"
}

/** The full average deck response from EDHREC. */
export interface EDHRECAverageDeck {
  cards: EDHRECAverageDeckCard[];
  deckList: string[];  // Text format: "1 Card Name"
  totalCards: number;
  numDecksAveraged: number;
}

export interface EDHRECAdapter {
  getCommanderRecommendations(commanderName: string): Promise<EDHRECRecommendation[]>;
  getAverageDeck(commanderName: string): Promise<EDHRECAverageDeck | null>;
}

// ---------------------------------------------------------------------------
// Slug conversion
// ---------------------------------------------------------------------------

export function toEdhrecSlug(commanderName: string): string {
  return commanderName
    .toLowerCase()
    .replace(/[,']/g, "")
    .replace(/\s+/g, "-");
}

// ---------------------------------------------------------------------------
// EDHREC response types
// ---------------------------------------------------------------------------

interface EdhrecCardlistEntry {
  name?: string;
  sanitized_wo?: string;
  synergy?: number;
  num_decks?: number;
  potential_decks?: number;
  image?: string;
}

interface EdhrecCardView {
  id?: string;
  name?: string;
  label?: string;
}

interface EdhrecPageJson {
  cardlists?: Array<{
    tag?: string;
    cardviews?: EdhrecCardlistEntry[];
  }>;
  cardlist?: EdhrecCardlistEntry[];
}

interface EdhrecAvgDeckJson {
  num_decks_avg?: number;
  total_card_count?: number;
  deck?: string[];
  container?: {
    json_dict?: {
      cardlists?: Array<{
        tag?: string;
        header?: string;
        cardviews?: EdhrecCardView[];
      }>;
    };
  };
  archidekt?: Array<{
    u?: string;  // Scryfall UUID
    q?: number;  // Quantity
    c?: string;  // Category code
  }>;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapRecommendation(entry: EdhrecCardlistEntry): EDHRECRecommendation {
  const numDecks = entry.num_decks ?? 0;
  const potentialDecks = entry.potential_decks ?? 1;
  const inclusionPercentage =
    potentialDecks > 0 ? Math.round((numDecks / potentialDecks) * 100) : 0;

  return {
    cardName: entry.name ?? entry.sanitized_wo ?? "Unknown",
    synergyScore: entry.synergy ?? 0,
    inclusionPercentage,
    imageUri: entry.image,
  };
}

/** Map a tag string to a readable category. */
function tagToCategory(tag: string): string {
  const map: Record<string, string> = {
    creatures: "creatures",
    instants: "instants",
    sorceries: "sorceries",
    artifacts: "artifacts",
    enchantments: "enchantments",
    planeswalkers: "planeswalkers",
    lands: "lands",
    basics: "basics",
  };
  return map[tag] ?? tag;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEDHRECAdapter(): EDHRECAdapter {
  const recCache = new Map<string, EDHRECRecommendation[]>();
  const avgCache = new Map<string, EDHRECAverageDeck>();

  return {
    async getCommanderRecommendations(
      commanderName: string,
    ): Promise<EDHRECRecommendation[]> {
      const slug = toEdhrecSlug(commanderName);
      const url = `https://json.edhrec.com/pages/commanders/${slug}.json`;

      try {
        const response = await fetch(url);
        if (!response.ok) return recCache.get(slug) ?? [];

        const json: EdhrecPageJson = await response.json();
        const entries: EdhrecCardlistEntry[] = [];

        if (json.cardlists) {
          for (const list of json.cardlists) {
            if (list.cardviews) entries.push(...list.cardviews);
          }
        }
        if (json.cardlist) entries.push(...json.cardlist);

        const recommendations = entries.map(mapRecommendation);
        recCache.set(slug, recommendations);
        return recommendations;
      } catch {
        return recCache.get(slug) ?? [];
      }
    },

    async getAverageDeck(
      commanderName: string,
    ): Promise<EDHRECAverageDeck | null> {
      const slug = toEdhrecSlug(commanderName);
      const cached = avgCache.get(slug);
      if (cached) return cached;

      const url = `https://json.edhrec.com/pages/average-decks/${slug}.json`;

      try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const json: EdhrecAvgDeckJson = await response.json();

        const cards: EDHRECAverageDeckCard[] = [];

        // Extract cards from the cardlists (grouped by type with Scryfall IDs)
        const cardlists = json.container?.json_dict?.cardlists ?? [];
        for (const list of cardlists) {
          const tag = tagToCategory(list.tag ?? "");
          if (list.cardviews) {
            for (const cv of list.cardviews) {
              if (cv.id && cv.name) {
                // Check if the label has a quantity prefix like "4 Forests"
                let qty = 1;
                const labelMatch = cv.label?.match(/^(\d+)\s/);
                if (labelMatch) qty = parseInt(labelMatch[1], 10);

                cards.push({
                  scryfallId: cv.id,
                  name: cv.name,
                  quantity: qty,
                  category: tag,
                });
              }
            }
          }
        }

        // Also parse the archidekt array for quantities (more reliable for basics)
        if (json.archidekt && json.archidekt.length > 0) {
          const archMap = new Map<string, number>();
          for (const entry of json.archidekt) {
            if (entry.u && entry.q) {
              archMap.set(entry.u, entry.q);
            }
          }
          // Update quantities from archidekt data
          for (const card of cards) {
            const archQty = archMap.get(card.scryfallId);
            if (archQty && archQty > 1) {
              card.quantity = archQty;
            }
          }
        }

        const result: EDHRECAverageDeck = {
          cards,
          deckList: json.deck ?? [],
          totalCards: json.total_card_count ?? 100,
          numDecksAveraged: json.num_decks_avg ?? 0,
        };

        avgCache.set(slug, result);
        return result;
      } catch {
        return null;
      }
    },
  };
}
