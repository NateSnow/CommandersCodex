/**
 * EDHREC adapter for fetching commander card recommendations.
 *
 * EDHREC does not have an official API. This adapter fetches JSON data from
 * their public-facing JSON endpoints (e.g.,
 * `https://json.edhrec.com/pages/commanders/{slug}.json`). This is a
 * community-known pattern but is not guaranteed to be stable — EDHREC may
 * change their URL structure at any time.
 */

import type { EDHRECRecommendation } from "../models/recommendation.js";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface EDHRECAdapter {
  getCommanderRecommendations(commanderName: string): Promise<EDHRECRecommendation[]>;
}

// ---------------------------------------------------------------------------
// Slug conversion
// ---------------------------------------------------------------------------

/**
 * Convert a commander name to an EDHREC URL slug.
 *
 * Rules:
 *  - Lowercase the entire name
 *  - Replace spaces with hyphens
 *  - Remove commas and apostrophes
 *
 * Example: "Atraxa, Praetors' Voice" → "atraxa-praetors-voice"
 */
export function toEdhrecSlug(commanderName: string): string {
  return commanderName
    .toLowerCase()
    .replace(/[,']/g, "")
    .replace(/\s+/g, "-");
}

// ---------------------------------------------------------------------------
// EDHREC response types (raw JSON shapes)
// ---------------------------------------------------------------------------

interface EdhrecCardlistEntry {
  name?: string;
  sanitized_wo?: string;
  synergy?: number;
  num_decks?: number;
  potential_decks?: number;
  image?: string;
}

interface EdhrecPageJson {
  cardlists?: Array<{
    tag?: string;
    cardviews?: EdhrecCardlistEntry[];
  }>;
  cardlist?: EdhrecCardlistEntry[];
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

// ---------------------------------------------------------------------------
// EDHRECAdapter factory
// ---------------------------------------------------------------------------

export function createEDHRECAdapter(): EDHRECAdapter {
  // Cache: maps commander slug → last successful recommendations
  const cache = new Map<string, EDHRECRecommendation[]>();

  return {
    async getCommanderRecommendations(
      commanderName: string,
    ): Promise<EDHRECRecommendation[]> {
      const slug = toEdhrecSlug(commanderName);
      const url = `https://json.edhrec.com/pages/commanders/${slug}.json`;

      try {
        const response = await fetch(url);

        if (!response.ok) {
          // Return cached data if available, otherwise empty array
          return cache.get(slug) ?? [];
        }

        const json: EdhrecPageJson = await response.json();

        // EDHREC structures recommendations in cardlists arrays or a
        // top-level cardlist. We collect entries from all available sources.
        const entries: EdhrecCardlistEntry[] = [];

        if (json.cardlists) {
          for (const list of json.cardlists) {
            if (list.cardviews) {
              entries.push(...list.cardviews);
            }
          }
        }

        if (json.cardlist) {
          entries.push(...json.cardlist);
        }

        const recommendations = entries.map(mapRecommendation);

        // Cache the successful response
        cache.set(slug, recommendations);

        return recommendations;
      } catch {
        // Network error, JSON parse error, etc. — return cached or empty
        return cache.get(slug) ?? [];
      }
    },
  };
}
