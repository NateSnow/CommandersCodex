/**
 * Commander Spellbook adapter for fetching card combo data.
 *
 * Uses the Commander Spellbook REST API at
 * `https://backend.commanderspellbook.com/variants/` with query parameter `q`
 * for search. Color identity filter syntax: `ci:wub` (lowercase color
 * letters). Card name filter: `card:"Card Name"`.
 */

import type { Color, ColorIdentity } from "../models/card.js";
import type { Combo } from "../models/recommendation.js";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface CommanderSpellbookAdapter {
  searchCombos(colorIdentity: ColorIdentity): Promise<Combo[]>;
  searchCombosByCard(
    cardName: string,
    colorIdentity: ColorIdentity,
  ): Promise<Combo[]>;
}

// ---------------------------------------------------------------------------
// Color identity → query string helpers
// ---------------------------------------------------------------------------

/** Map Color type letters to the lowercase letters used by Commander Spellbook. */
const COLOR_TO_LETTER: Record<Color, string> = {
  W: "w",
  U: "u",
  B: "b",
  R: "r",
  G: "g",
};

/**
 * Build the `ci:` query fragment from a ColorIdentity array.
 *
 * Example: `["W", "U", "B"]` → `"ci:wub"`
 */
export function buildColorIdentityQuery(colorIdentity: ColorIdentity): string {
  if (colorIdentity.length === 0) {
    return "ci:c"; // colorless
  }
  const letters = colorIdentity.map((c) => COLOR_TO_LETTER[c]).join("");
  return `ci:${letters}`;
}

// ---------------------------------------------------------------------------
// Commander Spellbook response types (raw JSON shapes)
// ---------------------------------------------------------------------------

interface SpellbookCard {
  card?: {
    name?: string;
  };
}

interface SpellbookResult {
  name?: string;
  description?: string;
}

interface SpellbookVariant {
  id?: string;
  uses?: SpellbookCard[];
  produces?: SpellbookResult[];
  otherPrerequisites?: string;
  description?: string;
  identity?: string;
}

interface SpellbookResponse {
  results?: SpellbookVariant[];
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/** Map a raw identity string (e.g. "W,U,B") to a ColorIdentity array. */
function parseIdentity(identity: string | undefined): Color[] {
  if (!identity) return [];
  const validColors = new Set<string>(["W", "U", "B", "R", "G"]);
  return identity
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is Color => validColors.has(s));
}

function mapVariantToCombo(variant: SpellbookVariant): Combo {
  const cards: string[] = (variant.uses ?? [])
    .map((u) => u.card?.name)
    .filter((n): n is string => typeof n === "string" && n.length > 0);

  const results: string[] = (variant.produces ?? [])
    .map((p) => {
      // Prefer the name/description field
      return p.name ?? p.description ?? "";
    })
    .filter((r) => r.length > 0);

  // Build a human-readable name from the card list
  const name =
    cards.length > 0 ? cards.join(" + ") : `Combo ${variant.id ?? "unknown"}`;

  return {
    id: variant.id ?? "",
    name,
    cards,
    colorIdentity: parseIdentity(variant.identity),
    description: variant.description ?? "",
    prerequisites: variant.otherPrerequisites ?? "",
    steps: variant.description ?? "",
    results,
  };
}

// ---------------------------------------------------------------------------
// CommanderSpellbookAdapter factory
// ---------------------------------------------------------------------------

export function createCommanderSpellbookAdapter(): CommanderSpellbookAdapter {
  const BASE_URL = "https://backend.commanderspellbook.com/variants/";

  async function fetchCombos(query: string): Promise<Combo[]> {
    const url = `${BASE_URL}?q=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        return [];
      }

      const json: SpellbookResponse = await response.json();
      const variants = json.results ?? [];

      return variants.map(mapVariantToCombo);
    } catch {
      // Network error, JSON parse error, etc.
      return [];
    }
  }

  return {
    async searchCombos(colorIdentity: ColorIdentity): Promise<Combo[]> {
      const ciQuery = buildColorIdentityQuery(colorIdentity);
      return fetchCombos(ciQuery);
    },

    async searchCombosByCard(
      cardName: string,
      colorIdentity: ColorIdentity,
    ): Promise<Combo[]> {
      const ciQuery = buildColorIdentityQuery(colorIdentity);
      const cardQuery = `card:"${cardName}"`;
      const query = `${cardQuery} ${ciQuery}`;
      return fetchCombos(query);
    },
  };
}
